import os
import requests
import geoip2.database
from git import Repo

def get_ips_by_country(country_code):
    # 使用API查询IP地址
    response = requests.get(f"https://ipdb.api.030101.xyz/?type=cfv4;proxy&down=true&country={country_code}")
    ips = response.text.split('\n')

    return ips

def save_to_file(ips, filename):
    with open(filename, 'a') as file:
        for ip in ips:
            file.write(f"{ip}\n")

def clear_and_commit(filename):
    # 删除 ip.txt 文件
    os.remove('ip.txt')

    # 提交和推送到远程存储库
    repo_dir = os.getcwd()
    repo = Repo(repo_dir)
    repo.git.add('--all')
    repo.index.commit("Update japan_ips.txt and delete ip.txt")
    origin = repo.remote('origin')
    origin.push()

if __name__ == "__main__":
    countries = ['JP', 'KR', 'HK', 'TW', 'SG', 'VN']  # 需要获取IP的国家代码列表
    for country_code in countries:
        ips = get_ips_by_country(country_code)
        save_to_file(ips, 'japan_ips.txt')
    
    clear_and_commit('ip.txt')
