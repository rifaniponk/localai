# The model server: Strata

[Strata](https://github.com/Niko1221/Strata) runs Qwen3.8-Flash-Next, a mixture-of-experts model, on one graphics
card plus system RAM, and serves it with an OpenAI- and Anthropic-compatible API.

## Machine

| Part | What |
|---|---|
| GPU | NVIDIA GeForce RTX 5080, 16 GB |
| CPU | AMD Ryzen 9 9950X (16 cores) |
| RAM | 96 GB DDR5 |
| OS | Linux |

## Model and settings

- Model: Qwen3.8-Flash-Next, IQ3_S quantization (`qwen3.8-flash-next-iq3_s` in the API).
- Context: 262,144 tokens (`--max-context 262144`). The K/V cache is int8 (`--kv int8`); 20,480 tokens of it stay in
  VRAM (`--kv-resident 20480`) and the rest lives in RAM.
- Everything else is what Strata's setup chose for this card (speculative decoding, expert cache, prefill).
- Speed on this machine (Strata's own benchmark suite): about 100 tokens/s decode, 3,300-4,000 tokens/s prompt
  reading on fresh 4K-16K prompts.
- One request is decoded at a time. A request that continues a conversation reads only the new part of the prompt
  (the conversation cache). Agent settings that keep prompts append-only and avoid side requests matter a lot here:
  see [../agents/omp/README.md](../agents/omp/README.md).

## Serving to other machines

The server listens on all interfaces with an API key: in Strata's `strata-<model>.json`, add

```json
"host": "0.0.0.0",
"api_key": "<a long random key>"
```

and restart it. Clients then use `http://<server-address>:9191/v1` with that key as a Bearer token. Every route,
including the chat history, needs the key; the web page loads without it and asks for it. Never expose the server
beyond your own network, and never without a key.
