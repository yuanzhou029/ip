name: Query Japan IPs

on:
  workflow_dispatch:  # 手动触发工作流程

jobs:
  query_ips:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.x'

      - name: Install GeoIP2 and GitPython
        run: |
          pip install geoip2 GitPython

      - name: Run Python script
        run: python query_japan_ips.py
