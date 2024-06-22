import os
import csv
import time
import requests
from requests.exceptions import RequestException

# 从环境变量中读取 Cloudflare API 认证信息
zone_id = os.getenv("CF_ZONE_ID")
x_email = os.getenv("CF_EMAIL")
api_key = os.getenv("CF_API_KEY")
subdomain = {
    "bpcdn": "result.csv",
    "cf-gf": "cf-gf.csv",
    "cf-fd": "cf-fd.csv"
}
domain = os.getenv("CF_DOMAIN")

# 获取 DNS 记录的函数
def get_dns_records():
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
    params = {
        "name": f"{subdomain}.{domain}",
        "type": "A,AAAA"
    }
    headers = {
        "X-Auth-Email": x_email,
        "X-Auth-Key": api_key,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        if data['success']:
            records = data['result']
            for record in records:
                record_id = record['id']
                delete_url = f"{url}/{record_id}"
                delete_response = requests.delete(delete_url, headers=headers)
                delete_data = delete_response.json()
                if delete_data['success']:
                    print(f"成功删除 DNS 记录：{record['name']}")
                else:
                    print("删除 DNS 记录失败")
        else:
            print("没有找到指定的 DNS 记录")
    except RequestException as e:
        print(f"处理 DNS 记录时发生异常: {str(e)}")

# 解析 CSV 文件中的 IP 地址
def parse_csv_file(csv_file):
    try:
        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            next(reader)  # 跳过标题行
            ips = [row[0] for row in reader]
            return ips
    except FileNotFoundError:
        print(f"CSV 文件 '{csv_file}' 不存在")
        return []

# 添加 IP 地址到 Cloudflare DNS 记录
def add_ips_to_dns_records(ips):
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
    headers = {
        "X-Auth-Email": x_email,
        "X-Auth-Key": api_key,
        "Content-Type": "application/json"
    }
    
    for ip in ips:
        record_type = "AAAA" if ":" in ip else "A"
        data = {
            "type": record_type,
            "name": f"{subdomain}.{domain}",
            "content": ip,
            "ttl": 60,
            "proxied": False
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            response_data = response.json()
            if response_data['success']:
                print(f"IP地址 {ip} 成功解析到 {subdomain}.{domain}")
            else:
                print(f"导入IP地址 {ip} 失败")
        except RequestException as e:
            print(f"导入 IP 地址时发生异常: {str(e)}")
        finally:
            # 每次请求后休眠3秒，避免请求过于频繁
            time.sleep(3)

# 主函数
def main():
    print("正在更新解析：多个优选IP解析到一个域名。请稍后...")
    get_dns_records()
    
    csv_file = 'result.csv'
    ips = parse_csv_file(csv_file)
    if ips:
        add_ips_to_dns_records(ips)

if __name__ == "__main__":
    main()
