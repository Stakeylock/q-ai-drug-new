import httpx
import sys

def main():
    email = "e2e_researcher@example.com"
    password = "Password123!"
    url = "http://127.0.0.1:8001/api/v1/auth/register"
    
    payload = {
        "email": email,
        "password": password,
        "full_name": "E2E Researcher",
        "workspace_name": "E2E Oncology Workspace"
    }
    
    print(f"Registering user {email} via {url}...")
    try:
        response = httpx.post(url, json=payload, timeout=10.0)
        if response.status_code == 200:
            print("[OK] User registered successfully!")
            print(response.json())
        else:
            print(f"[ERROR] Registration returned status {response.status_code}")
            print(response.text)
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
