#!/bin/bash
set -e

# Run the server using gunicorn
exec gunicorn --bind 0.0.0.0:8080 --timeout 3600 --error-logfile - echodhamma.server:app
