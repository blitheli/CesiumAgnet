FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install prerequisites and Microsoft package feed, then install .NET 8 SDK.
# dotnet-sdk-8.0 includes Microsoft.NETCore.App and ASP.NET Core Runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /etc/apt/keyrings/microsoft-prod.gpg \
    && chmod go+r /etc/apt/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/ubuntu/24.04/prod noble main" \
      > /etc/apt/sources.list.d/microsoft-prod.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends dotnet-sdk-8.0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
