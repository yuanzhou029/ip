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
    japan_ips = get_japan_ips()
    save_to_file(japan_ips, 'japan_ips.txt')
    clear_and_commit('ip.txt')
