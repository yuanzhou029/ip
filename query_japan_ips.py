import os
import requests
import zipfile
import geoip2.database
from git import Repo

def get_and_filter_ips(input_filename="ip.txt", output_filename="japan_ips.txt", start_line=16):
    """
    通过API获取IP地址并保存到文件，然后筛选出指定地区的IP并保存到另一个文件。

    Args:
        input_filename (str, optional): 存放所有IP地址的文件名. Defaults to "ip.txt".
        output_filename (str, optional): 存放筛选后IP地址的文件名. Defaults to "japan_ips.txt".
        start_line (int, optional): 从哪一行开始读取IP地址. Defaults to 15.
    """

    # --- 1. 下载IP地址文件 ---
    try:
        response = requests.get("https://ipdb.api.030101.xyz/?type=cfv4;proxy&down=true")
        response.raise_for_status()

        with open(input_filename, 'wb') as f: 
            f.write(response.content)  

        print(f"IP地址文件已下载到 {input_filename}") 

    except requests.exceptions.RequestException as e:
        print(f"下载IP地址文件时出错: {e}")
        return 

    # --- 2. 加载GeoIP2数据库 ---
    try:
        reader = geoip2.database.Reader('GeoLite2-Country.mmdb')
    except Exception as e:
        print(f"加载GeoIP2数据库时出错: {e}")
        return 

    # --- 3. 读取IP地址并筛选 ---
    japan_ips = [] 
    try:
        with open(input_filename, 'r') as f:
            for i, line in enumerate(f):  # 使用 enumerate 获取行号
                if i < start_line - 1:  # 跳过前面的行
                    continue
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
        return 

    # --- 4. 保存筛选后的IP地址 ---
    save_to_file(japan_ips, output_filename)  
    print(f"筛选后的IP地址已保存到 {output_filename}") 

def commit_and_push(filenames):
    """提交和推送到远程存储库"""
    repo_dir = os.getcwd()
    repo = Repo(repo_dir)

    # 在提交前修改 ip.txt，只保留前20行
    with open("ip.txt", "r+") as f:
        lines = f.readlines()
        f.seek(0)
        f.writelines(lines[:15])
        f.truncate()

    for filename in filenames:
        try:
            repo.git.add(filename) 
        except Exception as e:
            print(f"Error occurred while adding {filename}: {e}")
    
    repo.index.commit("Update files")
    origin = repo.remote('origin')
    origin.push()

def merge_txt_from_zip(zip_url, output_filename):
    """
    下载一个zip文件，解压其中的所有txt文件，
    合并所有解压后的txt文件的内容（去重），并将合并后的内容保存到指定文件。

    Args:
        zip_url (str): zip文件的下载链接
        output_filename (str): 合并后的内容要保存的文件名
    """

    # 获取zip文件名
    zip_filename = os.path.basename(zip_url)

    try:
        # 下载zip文件
        print(f"正在下载 {zip_filename} ...")
        with open(zip_filename, 'wb') as f:
            f.write(requests.get(zip_url).content)
        print(f"下载完成: {zip_filename}")

        # 解压zip文件
        print(f"正在解压 {zip_filename} ...")
        with zipfile.ZipFile(zip_filename, 'r') as zip_ref:
            zip_ref.extractall()
        print(f"解压完成: {zip_filename}")

        # 获取解压后的txt文件名列表
        extracted_txt_files = [filename for filename in zip_ref.namelist() if filename.endswith(".txt")]

        # 合并所有解压后的txt文件内容
        merged_lines = set()  # 使用set去重
        print(f"正在合并txt文件...")
        for filename in extracted_txt_files:
            with open(filename, 'r', encoding='utf-8') as f:
                merged_lines.update(f.readlines())

        # 保存合并后的内容到指定文件
        print(f"正在保存合并后的内容到 {output_filename} ...")
        with open(output_filename, 'w', encoding='utf-8') as f:
            for line in merged_lines:
                f.write(line)

        print(f"文件合并完成，保存到 {output_filename}")

    except Exception as e:
        print(f"发生错误: {e}")

    finally:
        # 删除下载的zip文件
        print(f"正在清理临时文件...")
        if os.path.exists(zip_filename):
            os.remove(zip_filename)
        # 删除解压后的txt文件
        for filename in extracted_txt_files:
            if os.path.exists(filename):
                os.remove(filename)
        print(f"清理完成")

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
    merge_txt_from_zip("https://zip.baipiao.eu.org", "zip.txt") 
    get_and_filter_ips(start_line=16)   # 获取并筛选IP地址从第16行开始
    
    # 在这里调用 commit_and_push，确保 ip.txt 仍然存在
    commit_and_push(['japan_ips.txt', 'ip.txt', 'zip.txt']) 

    # ... (其他代码与之前相同) ...
