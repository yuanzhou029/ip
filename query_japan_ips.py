import geoip2.database
import os
from git import Repo

def query_ip_info(ip_address):
    # 加载 GeoIP2 数据库
    reader = geoip2.database.Reader('GeoLite2-Country.mmdb')

    try:
        # 查询 IP 地址的地理位置信息
        response = reader.country(ip_address)
        country_name = response.country.name
        return country_name
    except geoip2.errors.AddressNotFoundError:
        return "Unknown"

def get_japan_ips(ip_list):
    # 查询日本的 IP 地址
    japan_ips = [ip for ip in ip_list if query_ip_info(ip) == "Japan"]
    return japan_ips

def save_to_file(ips, filename):
    with open(filename, 'w') as file:
        for ip in ips:
            file.write(ip + '\n')

def commit_and_push(filename):
    # 获取存储库根目录
    repo_dir = os.getcwd()

    # 切换到存储库根目录
    os.chdir(repo_dir)

    # 使用 GitPython 库进行提交和推送
    repo = Repo(repo_dir)
    repo.git.add(filename)
    repo.index.commit("Add Japan IPs")  # 提交更改
    origin = repo.remote('origin')
    origin.push()  # 推送更改到远程存储库

if __name__ == "__main__":
    # 读取存储库中的 ip.txt 文件
    with open('ip.txt', 'r') as file:
        ip_list = file.read().splitlines()

    # 查询日本的 IP 地址
    japan_ips = get_japan_ips(ip_list)

    # 将日本的 IP 地址保存到 jp.txt 文件中
    save_to_file(japan_ips, 'jp.txt')

    # 提交并推送更改到存储库
    commit_and_push('jp.txt')
