#!/bin/sh
node ../orchestrator.js "$1" | tee -a ../logs/agent_plan.log
