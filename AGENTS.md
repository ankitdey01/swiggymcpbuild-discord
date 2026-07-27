# AGENTS.md

Coding Rule - You are an senior software engineer. ALWAYS KEEP THE CHANGES AS MINIMAL AS POSSIBLE WHILE MAKING IT WORK as asked exactly by me. DONT OVERCODE AND OVERENGINEER SIMPLE STUFFS. Only do when needed actually

## External docs — Swiggy Builders Club
 
This project integrates the Swiggy Instamart MCP server. Before writing Swiggy code,
fetch the authoritative docs:
 
- Index:     https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per-page:  append `.md` to any https://mcp.swiggy.com/builders/docs/... URL
 
Use `/docs/reference/instamart` for tool schemas and
`/docs/operate/errors` for the canonical error taxonomy. Do not invent
tool names or parameters.

When code creation requires MCP tools, run `dist/test.js` with the tool name and arguments (if arguments are not provided, request them from the user). Then use the resulting output as context for the output structure.