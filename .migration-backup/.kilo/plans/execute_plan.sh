#!/bin/sh
# Simple wrapper to run orchestrator in node environment
node -e "require('./orchestrator').runPlan(process.argv[1] || 'Explore enhancements')" 
