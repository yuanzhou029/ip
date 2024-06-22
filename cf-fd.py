import requests
import csv
import time

def fetch_and_save_data(url, save_path, max_retries=3):
    retry_count = 0
    while retry_count < max_retries:
        # 发送GET请求到URL
        response = requests.get(url)

        # 检查请求是否成功（状态码为200）
        if response.status_code == 200:
            # 解码响应内容为文本
            content = response.text
            
            # 将内容分割成行
            lines = content.split('\n')
            
            # 以写入模式打开CSV文件
            with open(save_path, 'w', newline='', encoding='utf-8') as csvfile:
                # 创建CSV写入器对象
                csv_writer = csv.writer(csvfile)
                
                # 遍历每一行
                for line in lines:
                    # 通过空格分割行
                    data = line.split()
                    
                    # 将数据写入CSV文件
                    csv_writer.writerow(data)
            
            # 检查第二行是否有数据
            try:
                with open(save_path, 'r', newline='', encoding='utf-8') as csvfile:
                    csvreader = csv.reader(csvfile)
                    lines = list(csvreader)
                    if len(lines) >= 2 and lines[1]:
                        print("数据已保存到", save_path)
                        return True
                    else:
                        print("第二行无数据，重试中...")
            except FileNotFoundError:
                print("文件不存在，重试中...")
            except IndexError:
                print("第二行无数据，重试中...")

            retry_count += 1
            time.sleep(5)  # 间隔5秒后重试
        else:
            print(f"请求失败，状态码：{response.status_code}")
            retry_count += 1
            time.sleep(5)  # 间隔5秒后重试
    
    print(f"达到最大重试次数 {max_retries}，程序退出。")
    return False

# 测试用例
if __name__ == "__main__":
    url = "https://raw.githubusercontent.com/ymyuuu/IPDB/main/bestproxy.txt"
    save_path = "cf-fd.csv"
    fetch_and_save_data(url, save_path)
