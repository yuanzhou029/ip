import os
import requests
import json
import geoip2.database
from git import Repo
import zipfile

def get_and_filter_ips(input_filename="ip.txt", output_filename="japan_ips.txt"):
    """
    通过API获取IP地址并保存到文件，然后筛选出指定地区的IP并保存到另一个文件。

    Args:
        input_filename (str, optional): 存放所有IP地址的文件名. Defaults to "ip.txt".
        output_filename (str, optional): 存放筛选后IP地址的文件名. Defaults to "japan_ips.txt".
    """

    # 1. 获取IP地址并保存到文件
    try:
        response = requests.get("https://ipdb.api.030101.xyz/?type=cfv4;proxy&down=true")
        response.raise_for_status()  # 检查请求是否成功

        with open(input_filename, 'w') as f:
            f.write(response.text)

    except requests.exceptions.RequestException as e:
        print(f"获取IP地址时出错: {e}")
        return  # 提前结束函数

    # 2. 加载GeoIP2数据库
    try:
        reader = geoip2.database.Reader('GeoLite2-Country.mmdb')
    except Exception as e:
        print(f"加载GeoIP2数据库时出错: {e}")
        return  # 提前结束函数

    # 3. 读取IP地址并筛选
    japan_ips = []
    try:
        with open(input_filename, 'r') as f:
            for line in f:
                ip = line.strip()
                try:
                    response = reader.country(ip)
                    if response.country.iso_code in ['JP', 'KR', 'HK', 'TW', 'SG', 'VN']:
                        japan_ips.append(ip)
                except geoip2.errors.AddressNotFoundError:
                    print(f"IP地址 {ip} 未找到")
                except Exception as e:
                    print(f"处理IP地址 {ip} 时出错: {e}")

    except FileNotFoundError:
        print(f"文件未找到: {input_filename}")
        return  # 提前结束函数

    # 4. 保存筛选后的IP地址
    with open(output_filename, 'w') as f:
        for ip in japan_ips:
            f.write(ip + '\n')

    print(f"筛选后的IP地址已保存到 {output_filename}")


def commit_and_push(filenames):
    # 提交和推送到远程存储库
    repo_dir = os.getcwd()
    repo = Repo(repo_dir)
    
    for filename in filenames:
        try:
            repo.git.add(filename) # 如果文件被删除，这个命令会抛出异常
        except Exception as e:
            print(f"Error occurred while adding {filename}: {e}")
    
    repo.index.commit("Update files")
    origin = repo.remote('origin')
    origin.push()
def download_and_merge_txt(url, output_filename):
    """
    下载一个zip文件，解压并合并所有txt文件，去重后保存到指定文件。

    Args:
        url (str): zip文件的下载链接
        output_filename (str): 合并后的txt文件保存路径
    """

    try:
        # 下载zip文件
        response = requests.get(url)
        response.raise_for_status()  # 如果下载失败抛出异常

        zip_filename = os.path.basename(url)
        with open(zip_filename, 'wb') as f:
            f.write(response.content)

        # 解压zip文件
        with zipfile.ZipFile(zip_filename, 'r') as zip_ref:
            zip_ref.extractall()

        # 合并所有txt文件内容
        merged_lines = set()  # 使用set去重
        for filename in os.listdir():
            if filename.endswith(".txt"):
                with open(filename, 'r', encoding='utf-8') as f:
                    merged_lines.update(f.readlines())

        # 保存合并后的内容到指定文件
        with open(output_filename, 'w', encoding='utf-8') as f:
            for line in merged_lines:
                f.write(line)

        print(f"文件合并完成，保存到 {output_filename}")

    except Exception as e:
        print(f"发生错误: {e}")

    finally:
        # 删除下载的zip文件
        if os.path.exists(zip_filename):
            os.remove(zip_filename)
        # 删除解压后的txt文件
        for filename in os.listdir():
            if filename.endswith(".txt") and filename != output_filename:
                os.remove(filename)
def save_to_file(ips, filename):
    """将IP地址列表保存到指定文件。

    Args:
        ips (list): IP地址列表
        filename (str): 要保存的文件名
    """
    with open(filename, 'w') as f:
        for ip in ips:
            f.write(ip + '\n')                

if __name__ == "__main__":
    download_and_merge_txt("https://zip.baipiao.eu.org", "zip.txt")
    save_to_file(japan_ips, 'japan_ips.txt')
    
    # 在这里调用 commit_and_push，确保 ip.txt 仍然存在
    commit_and_push(['japan_ips.txt', 'ip.txt', 'zip.txt']) 

    # 如果你需要在提交后删除 ip.txt，可以在这里进行
    # delete_ip_file('ip.txt')
