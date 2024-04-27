import os
import requests
import json
import geoip2.database
from git import Repo

def get_japan_ips():
    # 使用API查询IP地址
    response = requests.get("https://ipdb.api.030101.xyz/?type=cfv4;proxy&down=true")
    ips = response.text.split('\n')

    # 加载GeoIP2数据库
    reader = geoip2.database.Reader('GeoLite2-Country.mmdb')

    japan_ips = []

    # 查询IP地址的地理位置，如果是日本则添加到列表中
    for ip in ips:
        try:
            response = reader.country(ip)
            if response.country.iso_code == 'JP':
                japan_ips.append(ip)
        except:
            pass

    return japan_ips

def save_to_file(ips, filename):
    with open(filename, 'w') as file:
        for ip in ips:
            file.write(f"{ip}\n")

def clear_ip_file(filename):
    with open(filename, 'w') as file:
        file.write('')  # 清空文件内容

def commit_and_push(filename):
    # 获取存储库根目录
    repo_dir = os.getcwd()

    # 切换到存储库根目录
    os.chdir(repo_dir)

    # 清空 ip.txt 文件
    clear_ip_file('ip.txt')

    # 使用GitPython库进行提交和推送
    repo = Repo(repo_dir)
    repo.git.add(filename)
    repo.index.commit("Update Japan IPs")  # 提交更改
    origin = repo.remote('origin')
    origin.push()  # 推送更改到远程存储库
if __name__ == "__main__":
    clear_ip_file('ip.txt')  # 清空 ip.txt 文件内容
    japan_ips = get_japan_ips()
    save_to_file(japan_ips, 'japan_ips.txt')
    commit_and_push('japan_ips.txt')
