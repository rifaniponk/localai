# local-setup

How the local AI behind this repo is set up: the model server, the coding agents that talk to it, and the
benchmarks used to tune them. The agents and the model run on one PC with no cloud AI APIs. This folder itself
(the configs, the benchmark harness and these notes) was written with Claude, a cloud model.

```
local-setup/
├── server/                 # the model server (Strata) and its settings
├── agents/<agent>/         # one folder per coding agent: its config files and what was measured
│   └── omp/                #   oh-my-pi
└── benchmarks/<agent>/     # the harness that measured each agent setting, and its results
    └── omp/
```

## Agents

| Agent | Folder | Result |
|---|---|---|
| [omp (oh-my-pi)](https://omp.sh) | [agents/omp](agents/omp/README.md) | see the folder: before/after on the same tasks |

## Adding another agent

1. Put its config files in `agents/<agent>/`, with secrets replaced by environment variable names or placeholders
   (never a real key, LAN address or home-directory path).
2. In `agents/<agent>/README.md`, say how to install the files, what each setting does, and what it was measured
   against (the machine, the server version, the tasks).
3. If you benchmark it, put the harness and a results summary in `benchmarks/<agent>/`. Raw run logs stay out of the
   repo: they contain local paths.

Nothing in this folder is deployed: the site build only publishes `landing/` and `apps/`.
