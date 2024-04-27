import requests

def download_ip_file(url, filename):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            with open(filename, 'wb') as file:
                file.write(response.content)
            print("IP addresses downloaded successfully.")
        else:
            print(f"Failed to download IP addresses. Status code: {response.status_code}")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    url = "https://ipdb.api.030101.xyz/?type=cfv4;proxy&down=true"
    filename = "ip.txt"
    download_ip_file(url, filename)
