from setuptools import setup, find_packages

# Read dependencies from requirements.txt
with open("requirements.txt", "r") as f:
    requirements = f.read().splitlines()

setup(
    name="kivy_youtube_downloader",
    version="1.0.0",
    author="Jednaz Lonestamp",
    author_email="jednazlonestamp9@gmail.com",
    description="A Kivy-based YouTube downloader using yt-dlp",
    packages=find_packages(),
    include_package_data=True,
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "yt-gui=main:run_app",  # Assumes your main app has a run_app() function
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.8',
)
