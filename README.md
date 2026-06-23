# n8n-nodes-statista-api

Official community node for the [Statista REST API](https://docs.platform.statista.ai/api-reference/introduction). Search and retrieve statistics, consumer insights, and market insights from Statista inside n8n workflows.

## Installation

### Community Nodes (recommended)

1. Open **Settings → Community Nodes** in n8n.
2. Click **Install**.
3. Enter `n8n-nodes-statista-api`.

### Self-hosted (custom mount)

```bash
cd n8n-nodes-statista-api
npm install
npm run build
```

Mount the package folder to your n8n custom extensions directory, then restart n8n.

## Credentials

Create **Statista API** credentials with your API key.

- Get an API key at [platform.statista.ai/join](https://platform.statista.ai/join)
- Authentication docs: [Statista authentication](https://docs.platform.statista.ai/start/authentication)

The credential test runs a lightweight statistics search to verify your key.

## Operations

### Statistics

| Operation | Description |
|---|---|
| **Search** | Search statistics by natural language or keywords |
| **Get Data** | Retrieve full chart data for a statistic by ID |

### Consumer Insights

| Operation | Description |
|---|---|
| **Search** | Search survey questions and answers by topic |
| **Get Data** | Fetch cross-tabulated survey data for question/answer IDs |

### Market Insights

| Operation | Description |
|---|---|
| **Search** | Search market insights indicators by topic |
| **Get Data** | Fetch chart data for a market insights indicator by ID |

## Example workflow

1. Add a **Statista API** node.
2. Select **Resource → Statistics**, **Operation → Search**.
3. Set **Query** to `e.g. electric vehicles`.
4. Connect a second **Statista API** node with **Operation → Get Data** and pass a statistic ID from the search results.

## Resources

- [Statista API reference](https://docs.platform.statista.ai/api-reference/introduction)
- [Statista platform](https://platform.statista.ai/)

## License

MIT
