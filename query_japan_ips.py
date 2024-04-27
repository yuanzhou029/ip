import os
import requests

def query_ip_info(ip):
    # 构建 API 请求 URL
    api_url = f"http://ip-api.com/json/{ip}?lang=zh-CN"

    # 发送 GET 请求
    response = requests.get(api_url)

    # 解析 JSON 响应
    data = response.json()

    # 提取地理信息中的国家
    country = data.get("country", "未知")

    return country

def save_japan_ips_to_file(ips, filename):
    # 将获取到的日本 IP 地址写入文件
    with open(filename, 'w') as file:
        for ip in ips:
            file.write(f"{ip}\n")

def commit_and_push(filename):
    # 提交并推送文件到Git仓库
    os.system(f"git add {filename}")
    os.system(f'git commit -m "Update {filename}"')
    os.system("git push")

if __name__ == "__main__":
    # 读取存储库中的 ip.txt 文件
    with open("ip.txt", "r") as file:
        ips = file.readlines()
    
    # 去除换行符
    ips = [ip.strip() for ip in ips]

    # 查询IP地址的地理信息，并筛选出日本的IP地址
    japan_ips = [ip for ip in ips if query_ip_info(ip) == "日本"]

    # 将日本的IP地址保存到文件中
    save_japan_ips_to_file(japan_ips, 'japan_ips.txt')

    # 提交并推送文件到Git仓库
    commit_and_push('japan_ips.txt')
