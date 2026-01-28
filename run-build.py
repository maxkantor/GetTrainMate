#!/usr/bin/env python3
"""Run the optimized Lambda build script"""
import subprocess
import os
import sys

def run_command(cmd, cwd=None):
    """Run a shell command and return the result"""
    print(f"▶️  Running: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            check=False,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return False

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    api_dir = os.path.join(base_dir, "apps", "api")
    
    print("🔨 Building optimized .NET 8 Lambda package...")
    print("")
    
    # Clean
    print("🧹 Cleaning previous builds...")
    run_command("rm -rf bin obj publish", cwd=api_dir)
    
    # Build
    print("📦 Publishing .NET 8 Release build...")
    if not run_command("dotnet publish -c Release -o ./publish", cwd=api_dir):
        print("❌ Build failed!")
        return 1
    
    # Create zip
    print("📦 Creating optimized zip...")
    publish_dir = os.path.join(api_dir, "publish")
    deploy_dir = os.path.join(base_dir, "deploy")
    os.makedirs(deploy_dir, exist_ok=True)
    
    zip_cmd = (
        f"cd {publish_dir} && "
        f"rm -f {os.path.join(deploy_dir, 'gettrainmate-api-lambda.zip')} && "
        f"zip -r {os.path.join(deploy_dir, 'gettrainmate-api-lambda.zip')} . "
        f'-x "*.pdb" -x "*.xml" -x "runtimes/*" -x "*.so" -x "xunit*" -x "Moq*"'
    )
    
    if not run_command(zip_cmd):
        print("❌ Zip creation failed!")
        return 1
    
    # Check size
    zip_path = os.path.join(deploy_dir, "gettrainmate-api-lambda.zip")
    if os.path.exists(zip_path):
        size_bytes = os.path.getsize(zip_path)
        size_mb = size_bytes / (1024 * 1024)
        print("")
        print(f"✅ Lambda zip created successfully!")
        print(f"📊 Size: {size_mb:.2f} MB")
        print(f"📍 Location: {zip_path}")
        print("")
        
        if size_mb > 50:
            print("⚠️  Size exceeds 50 MB limit. Deploy via S3:")
            print("")
            print("  aws s3 cp deploy/gettrainmate-api-lambda.zip s3://getrainmate-media-bucket/lambda/gettrainmate-api-lambda.zip")
            print("  aws lambda update-function-code \\")
            print("    --function-name GetTrainMateStack-ApiFunctionCE271BD4-nktpjXfuOe0u \\")
            print("    --s3-bucket getrainmate-media-bucket \\")
            print("    --s3-key lambda/gettrainmate-api-lambda.zip")
        else:
            print("✅ Size is under 50 MB - you can upload directly via AWS Console!")
    else:
        print("❌ Zip file not found!")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
