import requests
import csv
from requests.exceptions import RequestException

def fetch_and_save_ips(url, key, output_csv='result.csv'):
    """
    从指定的URL获取IP数据并将符合条件的IP地址保存到CSV文件中

    参数:
    url (str): 请求IP数据的URL
    key (str): 请求所需的密钥
    output_csv (str): 保存结果的CSV文件名，默认是'result.csv'
    """
    data = {
        "key": key  # 请求体数据包含密钥
    }

    try:
        # 发送POST请求以获取IP数据
        response = requests.post(url, json=data)
        response.raise_for_status()  # 如果响应状态码不是200，会引发HTTPError

        # 解析响应的JSON数据
        result = response.json()
        code = result.get("code")
        if code == 200:
            info = result.get("info", {})

            # 打开CSV文件以写入数据
            with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ["IP地址", "节点类别", "线路", "节点", "延迟", "下载速度", "时间"]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()  # 写入CSV文件的表头

                # 遍历每个节点类别及其对应的IP信息
                for category, ips in info.items():
                    for ip_info in ips:
                        # 获取并处理延迟字符串，去掉"ms"单位并转换为浮点数
                        delay_str = ip_info.get("delay", "").replace("ms", "")
                        try:
                            delay = float(delay_str)
                            if delay <= 100:  # 只处理延迟不超过100ms的IP地址
                                print(f"处理 IP 地址: {ip_info['ip']}，延迟: {delay}")
                                writer.writerow({
                                    "IP地址": ip_info["ip"],
                                    "节点类别": category,
                                    "线路": ip_info["line"],
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

# 使用示例
url = "https://api.345673.xyz/get_data"
key = "o1zrmHAF"
fetch_and_save_ips(url, key)