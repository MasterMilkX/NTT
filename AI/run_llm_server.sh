#!/bin/bash

python -m uvicorn llm_server:app --host 127.0.0.1 --port 8008
