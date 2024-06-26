#!/bin/sh

# 更新软件包列表
echo "更新系统..."
opkg update
#安装GIT软件包
echo "安装openwrt的git软件包..."
opkg uopkg install git
#验证是否安装成功
echo "验证安装包是否安装成功..."
git --version

# 安装 git-http 包
echo "Installing git-http..."
opkg install git-http

# 安装 ca-certificates 包
echo "Installing ca-certificates..."
opkg install ca-certificates

# 设置Git用户信息
echo "Configuring global Git user information..."
git config --global user.email "yuanzhou029@126.com"
git config --global user.name "yuanzhou029"

# 配置凭据存储
git config --global credential.helper store

# 克隆 master 分支
REPO_URL="https://github.com/yuanzhou029/openai.js.git"
BRANCH="master"

echo "Cloning repository from $REPO_URL, branch: $BRANCH..."
git clone -b $BRANCH $REPO_URL

echo "Repository cloned successfully."

# 进入克隆的存储库目录
cd openai.js

# 推送到远程存储库
echo "Pushing changes to the remote repository..."
git push origin master

echo "Everything is up-to-date."
