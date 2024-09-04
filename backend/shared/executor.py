from concurrent.futures import ThreadPoolExecutor
from os import cpu_count

# Automatically determine the number of threads
num_workers = cpu_count() * 2  # Use twice the number of CPUs
executor = ThreadPoolExecutor(max_workers=num_workers)