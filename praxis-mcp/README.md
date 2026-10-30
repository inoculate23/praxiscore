# PraxisLIVE MCP server

Build and control real audio/video graphs through an MCP client. Python 3.10+,
Java 21+, and the PraxisCORE distribution in this checkout are required. No Python
packages are needed.

This server owns a **dedicated PraxisCORE process**. It does not attach to the
PraxisLIVE desktop application's open project or use the web backend's simulated
command/render endpoints. Graphs live in memory until the MCP session ends.
Audio output and video windows run on the machine hosting the server; media is
not streamed through MCP. Recording requires configuring runtime recording
components; there is no simulated render tool.

## Build and run

From the repository root:

```sh
./mvnw -pl praxiscore-bin -am package -DskipTests
python3 praxis-mcp/server.py
```

The server reads newline-delimited MCP JSON-RPC on stdin. It stays quiet until a
client sends requests and starts PraxisCORE on the first runtime tool call. All
runtime logs go to stderr. The runtime must be rebuilt to include `--machine`.

Add this entry to your MCP client's server configuration (adjust checkout path
and Python executable as needed):

```json
{
  "mcpServers": {
    "praxis-live": {
      "command": "python3",
      "args": ["/Users/craigellenwood/praxiscore/praxis-mcp/server.py"]
    }
  }
}
```

Use `--runtime /absolute/path/to/bin/praxis` to select another distribution
built from these sources, and `--timeout 60` to allow longer compilations. This
server provides the initialized stdio MCP protocol, negotiating versions
2024-11-05 through 2025-11-25. It exposes tools, with no resources or prompts.

## Tools

| Tool | Purpose |
| --- | --- |
| `runtime_status` | Check whether the owned runtime is running |
| `component_catalog` | Discover built-in component types in this checkout |
| `create_component` | Create roots and audio/video/data components |
| `inspect_component` | Read component info, children, or connections |
| `control` | Read/set controls, send triggers, replace live code |
| `connect_ports` | Connect or disconnect sibling ports |
| `pipeline` | Start/stop root audio/video pipelines |
| `remove_component` | Delete a component or root |
| `evaluate_script` | Execute arbitrary multiline PCL, including custom code |

Use `inspect_component` with `query: "info"` to discover exact controls, port
names, accepted values, and code templates. A control call with no `values`
reads a property or invokes a trigger; `values: [440]` sets a property.
Strings are escaped as literal PCL values. For resource properties, use a URI
such as `file:///absolute/path/movie.mp4`, according to the component's info.
The raw script tool can also use PCL's `[file "/absolute/path/movie.mp4"]`.

## Example: quiet oscillator and video noise

Call `evaluate_script` with this script. It creates stopped pipelines:

```text
@ /audio root:audio {
  @ ./osc audio:osc {
    .frequency 220
    .level 0.05
  }
  @ ./output audio:output
  ~ ./osc!out ./output!in-1
}
@ /video root:video {
  @ ./noise video:source:noise
  @ ./output video:output
  ~ ./noise!out ./output!in
}
```

Then call:

```json
{"name":"pipeline","arguments":{"address":"/audio","action":"start"}}
{"name":"pipeline","arguments":{"address":"/video","action":"start"}}
{"name":"control","arguments":{"address":"/audio/osc","control":"frequency","values":[440]}}
{"name":"pipeline","arguments":{"address":"/audio","action":"stop"}}
{"name":"pipeline","arguments":{"address":"/video","action":"stop"}}
```

Starting pipelines needs working local audio/graphics drivers. Example audio is
connected to channel 1 only. To edit custom processing code, create `audio:custom`
or `video:custom`, inspect its info/template, and set its `code` control.

## Failure and lifecycle behavior

Commands execute serially, with a runtime reply for each script. Runtime errors
become MCP tool errors. PCL scripts are not transactions: earlier statements can
succeed before a later statement fails. A timeout terminates the runtime so that
late replies cannot be assigned to later requests; restart the MCP session after
a timeout or runtime exit. EOF on MCP stdin terminates the owned process.

`evaluate_script` and live Java code execute with the hosting user's permissions.
Use a trusted local client. This server exposes no network listener and does not
install itself into any client configuration.

The Java `--machine` mode uses one base64-encoded UTF-8 script per stdin line,
`PRAXIS_READY` at startup, and `PRAXIS_OK <base64>` / `PRAXIS_ERROR <base64>` replies.
It bypasses JLine while preserving the existing interactive terminal behavior.
Only one command may be in flight with this transport.

## Verification

```sh
python3 -m unittest discover -s praxis-mcp/tests -v
```

The integration tests use the built runtime to create stopped audio/video graphs,
wire/disconnect ports, set/read controls, round-trip escaped strings, inspect
components, delete components, and recover from runtime errors. They also test
MCP framing and timeout cleanup. They do not start audio hardware or video
windows. Build the runtime first; integration tests skip if it is absent.

## Browser shader mixer Auto mode

The `mixer_status`, `mixer_auto`, and `mixer_next` tools control the browser player
through the localhost server, independently of the Java runtime. Start:

```sh
python3 examples/shader-mixer/serve.py
```

Open http://127.0.0.1:8765 and reload/reconnect the MCP client to discover the
added tools. Example tool call:

```json
{"name":"mixer_auto","arguments":{"enabled":true,"hold_seconds":12,"fade_seconds":4,"pool":"all","rotate_blends":false}}
```

Use `enabled: false` to stop Auto. Unspecified settings are preserved. The bridge
requires an acknowledgment from the open control tab; it does not report a command
as applied when no browser is connected. `mixer_status` reports the actual browser
state. `mixer_next` enables Auto if necessary and advances a transition. See the
[shader mixer README](../examples/shader-mixer/README.md) for controls and behavior.
A nondefault local port can be set with the `PRAXIS_MIXER_URL` environment variable.
