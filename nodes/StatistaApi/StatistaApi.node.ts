import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

const BASE_URL = 'https://api.statista.ai/v1';

const PREMIUM_OPTIONS = [
	{ name: 'All (Free + Premium)', value: 'all' },
	{ name: 'Free Only', value: 'false' },
	{ name: 'Premium Only', value: 'true' },
];


function requireNonEmptyQuery(ctx: IExecuteFunctions, query: string, itemIndex: number): void {
	if (!query.trim()) {
		throw new NodeOperationError(ctx.getNode(), 'Query is required and cannot be empty', { itemIndex });
	}
}

function requirePositiveStatisticId(ctx: IExecuteFunctions, statisticId: number, itemIndex: number): void {
	if (!statisticId || statisticId <= 0) {
		throw new NodeOperationError(ctx.getNode(), 'Statistic ID must be a positive number', { itemIndex });
	}
}

function requireNonEmptyString(
	ctx: IExecuteFunctions,
	value: string,
	fieldName: string,
	itemIndex: number,
): void {
	if (!value.trim()) {
		throw new NodeOperationError(ctx.getNode(), `${fieldName} is required and cannot be empty`, {
			itemIndex,
		});
	}
}

async function fetchPaginatedItems(
	ctx: IExecuteFunctions,
	url: string,
	baseQs: Record<string, string | number | boolean>,
	returnAll: boolean,
	limit: number,
): Promise<IDataObject[]> {
	if (!returnAll) {
		const response = await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'statistaApi', {
			method: 'GET',
			url,
			qs: { ...baseQs, size: limit, offset: 0 },
			returnFullResponse: false,
		});
		const result = response as { items: IDataObject[] };
		return result.items ?? [];
	}

	let offset = 0;
	const pageSize = 50;
	let allItems: IDataObject[] = [];

	while (true) {
		const response = await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'statistaApi', {
			method: 'GET',
			url,
			qs: { ...baseQs, size: pageSize, offset },
			returnFullResponse: false,
		});
		const batch = response as { items: IDataObject[]; total_count: number };
		allItems = allItems.concat(batch.items ?? []);
		if (allItems.length >= batch.total_count || (batch.items?.length ?? 0) < pageSize) break;
		offset += pageSize;
	}

	return allItems;
}

export class StatistaApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Statista API',
		name: 'statistaApi',
		icon: 'file:statista.svg',
		group: ['transform'],
		version: [1],
		defaultVersion: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Consume the Statista REST API for statistics, consumer insights, and market insights (search and data endpoints).',
		documentationUrl: 'https://docs.platform.statista.ai/api-reference/introduction',
		defaults: {
			name: 'Statista API',
		},
		codex: {
			categories: ['Data & Storage'],
			subcategories: {
				'Data & Storage': ['API'],
			},
			alias: ['Statista', 'Statistics', 'Market Data', 'Consumer Insights'],
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.platform.statista.ai/api-reference/introduction',
					},
				],
			},
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'statistaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Consumer Insight', value: 'consumerInsights' },
					{ name: 'Market Insight', value: 'marketInsights' },
					{ name: 'Statistic', value: 'statistics' },
				],
				default: 'statistics',
			},

			// ─── Statistics ─────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['statistics'] } },
				options: [
					{
						name: 'Get Data',
						value: 'getData',
						description: 'Retrieve full chart data for a statistic by ID',
						action: 'Get statistic data',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search statistics by natural language or keywords',
						action: 'Search statistics',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				description: 'Natural language or keyword query to search Statista statistics',
				displayOptions: { show: { resource: ['statistics'], operation: ['search'] } },
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { resource: ['statistics'], operation: ['search'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: { resource: ['statistics'], operation: ['search'], returnAll: [false] },
				},
			},
			{
				displayName: 'Additional Filters',
				name: 'additionalFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['statistics'], operation: ['search'] } },
				options: [
					{
						displayName: 'Date From',
						name: 'date_from',
						type: 'dateTime',
						default: '',
						description: 'Start date to filter statistics (e.g. 2022-01-01)',
					},
					{
						displayName: 'Date To',
						name: 'date_to',
						type: 'dateTime',
						default: '',
						description: 'End date to filter statistics. Defaults to current date if not set.',
					},
					{
						displayName: 'Premium Only',
						name: 'premium',
						type: 'options',
						options: PREMIUM_OPTIONS,
						default: 'all',
						description: 'Filter by content access type',
					},
				],
			},
			{
				displayName: 'Statistic ID',
				name: 'statisticId',
				type: 'number',
				required: true,
				default: 0,
				description: 'The unique numeric identifier of the Statista statistic',
				displayOptions: { show: { resource: ['statistics'], operation: ['getData'] } },
			},

			// ─── Consumer Insights ──────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['consumerInsights'] } },
				options: [
					{
						name: 'Get Data',
						value: 'getData',
						description: 'Fetch cross-tabulated survey data for question/answer IDs',
						action: 'Get consumer insights data',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search survey questions and answers by topic',
						action: 'Search consumer insights',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				description:
					'Short precise search terms (e.g. "gen z", "headphone brands"). Avoid long sentences or country names.',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['search'] } },
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['search'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 25 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['consumerInsights'],
						operation: ['search'],
						returnAll: [false],
					},
				},
			},
			{
				displayName: 'Rows',
				name: 'rows',
				type: 'string',
				required: true,
				default: '',
				description: 'Question or answer ID from search results (e.g. v0025_demo_regiondeu#3)',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['getData'] } },
			},
			{
				displayName: 'Columns',
				name: 'columns',
				type: 'string',
				default: '',
				description: 'Optional question or answer ID for the column variable in a cross table',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['getData'] } },
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'string',
				default: '',
				description:
					'Optional comma-separated answer IDs to filter respondents (e.g. v0013g_demo_generation#4,v0025_demo_regiondeu#3)',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['getData'] } },
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				description: 'Optional ISO 3166-1 alpha-3 country code (e.g. USA, GBR)',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['getData'] } },
			},
			{
				displayName: 'Year',
				name: 'year',
				type: 'number',
				default: 0,
				description: 'Survey year (4 digits). Leave at 0 to use the current year.',
				displayOptions: { show: { resource: ['consumerInsights'], operation: ['getData'] } },
			},

			// ─── Market Insights ────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['marketInsights'] } },
				options: [
					{
						name: 'Get Data',
						value: 'getData',
						description: 'Fetch chart data for a market insights indicator by ID',
						action: 'Get market insights data',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search market insights indicators by topic',
						action: 'Search market insights',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				description: 'Natural language or keyword query to search market insights indicators',
				displayOptions: { show: { resource: ['marketInsights'], operation: ['search'] } },
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { resource: ['marketInsights'], operation: ['search'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 25 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['marketInsights'],
						operation: ['search'],
						returnAll: [false],
					},
				},
			},
			{
				displayName: 'Indicator ID',
				name: 'indicatorId',
				type: 'string',
				required: true,
				default: '',
				description: 'Market insights indicator ID from search results',
				displayOptions: { show: { resource: ['marketInsights'], operation: ['getData'] } },
			},
			{
				displayName: 'Geo Codes',
				name: 'geo',
				type: 'string',
				default: 'WLD',
				description:
					'Comma-separated geo codes from search results (e.g. WLD or DEU,FRA,EUR). Maximum 5 codes.',
				displayOptions: { show: { resource: ['marketInsights'], operation: ['getData'] } },
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			try {
				if (resource === 'statistics' && operation === 'search') {
					const query = this.getNodeParameter('query', i) as string;
					requireNonEmptyQuery(this, query, i);

					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? 50 : (this.getNodeParameter('limit', i) as number);
					const filters = this.getNodeParameter('additionalFilters', i) as Record<string, string>;

					const qs: Record<string, string | number | boolean> = { q: query };
					if (filters.date_from) qs.date_from = filters.date_from;
					if (filters.date_to) qs.date_to = filters.date_to;
					if (filters.premium && filters.premium !== 'all') qs.premium = filters.premium === 'true';

					const itemsResult = await fetchPaginatedItems(
						this,
						`${BASE_URL}/search/statistics`,
						qs,
						returnAll,
						limit,
					);
					returnData.push(
						...itemsResult.map((item) => ({ json: item, pairedItem: { item: i } })),
					);
				} else if (resource === 'statistics' && operation === 'getData') {
					const statisticId = this.getNodeParameter('statisticId', i) as number;
					requirePositiveStatisticId(this, statisticId, i);

					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'statistaApi', {
						method: 'GET',
						url: `${BASE_URL}/data/statistic`,
						qs: { id: statisticId },
						returnFullResponse: false,
					});
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
				} else if (resource === 'consumerInsights' && operation === 'search') {
					const query = this.getNodeParameter('query', i) as string;
					requireNonEmptyQuery(this, query, i);

					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? 25 : (this.getNodeParameter('limit', i) as number);

					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'statistaApi', {
						method: 'GET',
						url: `${BASE_URL}/search/consumer-insights`,
						qs: { q: query, size: limit },
						returnFullResponse: false,
					});
					const result = response as { results: IDataObject[] };
					returnData.push(
						...(result.results ?? []).map((item) => ({ json: item, pairedItem: { item: i } })),
					);
				} else if (resource === 'consumerInsights' && operation === 'getData') {
					const rows = this.getNodeParameter('rows', i) as string;
					requireNonEmptyString(this, rows, 'Rows', i);

					const columns = this.getNodeParameter('columns', i, '') as string;
					const filters = this.getNodeParameter('filters', i, '') as string;
					const country = this.getNodeParameter('country', i, '') as string;
					const year = this.getNodeParameter('year', i) as number;

					const qs: Record<string, string | number> = { rows };
					if (columns) qs.columns = columns;
					if (filters) qs.filters = filters;
					if (country) qs.country = country;
					if (year > 0) qs.year = year;

					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'statistaApi', {
						method: 'GET',
						url: `${BASE_URL}/data/consumer-insights`,
						qs,
						returnFullResponse: false,
					});
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
				} else if (resource === 'marketInsights' && operation === 'search') {
					const query = this.getNodeParameter('query', i) as string;
					requireNonEmptyQuery(this, query, i);

					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? 25 : (this.getNodeParameter('limit', i) as number);

					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'statistaApi', {
						method: 'GET',
						url: `${BASE_URL}/search/market-insights/indicators`,
						qs: { q: query, size: limit },
						returnFullResponse: false,
					});
					const result = response as { items: IDataObject[] };
					returnData.push(
						...(result.items ?? []).map((item) => ({ json: item, pairedItem: { item: i } })),
					);
				} else if (resource === 'marketInsights' && operation === 'getData') {
					const indicatorId = this.getNodeParameter('indicatorId', i) as string;
					const geo = this.getNodeParameter('geo', i) as string;
					const response = await this.helpers.httpRequestWithAuthentication.call(this, 'statistaApi', {
						method: 'GET',
						url: `${BASE_URL}/data/market-insights/indicator`,
						qs: { id: indicatorId, geo },
						returnFullResponse: false,
					});
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unknown operation "${operation}" for resource "${resource}"`,
						{ itemIndex: i },
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message } as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
