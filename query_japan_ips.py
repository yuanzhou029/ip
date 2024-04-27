import os
import requests
import json
import geoip2.database
from git import Repo

def get_country_ips(country_code):
    # 使用API查询IP地址
    response = requests.get(f"https://ipdb.api.030101.xyz/?type=cfv4;proxy;country={country_code}&down=true")
    ips = response.text.split('\n')
    return ips

def save_ips_to_file(ips, country_code, filename):
    with open(filename, 'a') as file:
        for ip in ips:
            file.write(f"{ip} #{country_code}\n")

def clear_and_commit(filename):
    # 删除指定文件
    os.remove(filename)

    # 提交和推送到远程存储库
    repo_dir = os.getcwd()
    repo = Repo(repo_dir)
    repo.git.add('--all')
    repo.index.commit(f"Update {filename} and delete ip.txt")
    origin = repo.remote('origin')
    origin.push()

if __name__ == "__main__":
    # 获取不同国家的IP地址列表并保存到文件中
    countries = ['JP', 'KR', 'HK', 'TW', 'SG', 'VN']
    for country_code in countries:
        country_ips = get_country_ips(country_code)
        save_ips_to_file(country_ips, country_code, 'japan_ips.txt')

    # 清除并提交 ip.txt 文件
    clear_and_commit('ip.txt')
