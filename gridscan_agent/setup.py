"""
Gridscan Agent — Cardano Blockchain AI Agent Module

A standalone, pip-installable module that gives an AI model (Anthropic Claude)
tool-calling access to all 90 Gridscan / Cardano API endpoints.
"""
from setuptools import setup, find_packages

setup(
    name="gridscan-agent",
    version="1.0.0",
    description="Cardano blockchain AI agent with Anthropic tool-calling for the Gridscan API",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="BitBot Pro",
    url="https://github.com/bitbotpro/gridscan-agent",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "anthropic>=0.40.0",
        "httpx>=0.25.0",
        "fastapi>=0.100.0",
        "uvicorn>=0.23.0",
        "pydantic>=2.0.0",
    ],
    extras_require={
        "dev": ["pytest", "pytest-asyncio", "black", "ruff"],
    },
    entry_points={
        "console_scripts": [
            "gridscan-agent-cli=gridscan_agent.test_cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
)
