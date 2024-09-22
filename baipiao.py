import argparse
import requests
import csv
from requests.exceptions import RequestException

def fetch_and_save_ips(url, key, delay_limit, output_csv='result.csv'):
    data = {"key": key}
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()

        result = response.json()
        code = result.get("code")
        if code == 200:
            info = result.get("info", {})
            with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ["IP地址", "节点类别", "线路", "节点", "延迟", "下载速度", "时间"]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                for category, ips in info.items():
                    for ip_info in ips:
                        delay_str = ip_info.get("delay", "").replace("ms", "")
                        try:
                            delay = float(delay_str)
                            if delay <= delay_limit:
                                line = ip_info.get("line")
                                if line in ["CM", "CU", "CT"]:  # 这里检查线路是否符合要求
                                    print(f"处理 IP 地址: {ip_info['ip']}，延迟: {delay}")
                                    writer.writerow({
                                        "IP地址": ip_info["ip"],
                                        "节点类别": category,
                                        "线路": line,
                                        "节点": ip_info["node"],
                                        "延迟": delay,
                                        "下载速度": ip_info["downloadspeed"],
                                        "时间": ip_info["time"]
                                    })
                        except ValueError:
                            print(f"无法转换延迟值为浮点数：{ip_info['delay']}")
        else:
            print(f"请求失败，错误信息：{result.get('info')}")
    except RequestException as e:
        print(f"请求 IP 数据时发生异常: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Fetch and save IPs with a delay limit.')
    parser.add_argument('--delay-limit', type=float, default=100, help='The delay limit for IPs.')
    args = parser.parse_args()

    url = "	https://www.182682.xyz/api/cf2dns/get_cloudfront_ip"
    key = "o1zrmHAF"
    max_retries = 3
    retry_count = 0
    result_file = "result.csv"

    while retry_count < max_retries:
        fetch_and_save_ips(url, key, args.delay_limit, result_file)
        # 检查 result.csv 文件第三行是否有数据
        try:
            with open(result_file, 'r', newline='', encoding='utf-8') as csvfile:
                csvreader = csv.reader(csvfile)
                lines = list(csvreader)
                if len(lines) >= 4 and lines[2]:
                    print("result.csv 文件存在且第三行有数据")
                    break
                else:
                    print("result.csv 文件不存在或第三行无数据，重试中...")
        except FileNotFoundError:
            print("result.csv 文件不存在，重试中...")
        except IndexError:
            print("result.csv 文件第三行无数据，重试中...")
        
        retry_count += 1
        # 每次重试增加延迟限制30
        args.delay_limit += 30
        print(f"增加延迟限制为: {args.delay_limit}")

    if retry_count >= max_retries:
        print(f"达到最大重试次数 {max_retries}，程序退出。")


if __name__ == "__main__":
    main()
