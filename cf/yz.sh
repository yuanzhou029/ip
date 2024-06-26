#!/bin/bash

# 下载并运行 cdnopw.sh 脚本
curl -ksSL https://gitlab.com/rwkgyg/cdnopw/raw/main/cdnopw.sh -o cdnopw.sh
bash cdnopw.sh

# 退出当前会话
exit

# 进入 /root/cfipopw 目录
cd /root/cfipopw

# 从 URL 下载新的 cdnip.sh 并覆盖原有文件
curl -ksSL https://raw.githubusercontent.com/yuanzhou029/ip/main/cf/cdnip.sh -o cdnip.sh

# 覆盖 /root/cfipop 下的 wcdnac.sh 文件
curl -ksSL https://raw.githubusercontent.com/yuanzhou029/ip/main/cf/cdnac.sh -o /root/cfipop/wcdnac.sh

# 执行 git-openai.sj.sh 脚本
curl -ksSL https://raw.githubusercontent.com/yuanzhou029/ip/main/cf/git-openai.sj.sh | bash
