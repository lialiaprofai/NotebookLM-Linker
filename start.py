import sys
import os
import subprocess
import time

def main():
    # Base directory of the project
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Path to python in virtual environment
    venv_python = os.path.join(base_dir, ".venv", "bin", "python")
    if not os.path.exists(venv_python):
        venv_python = "python3"  # fallback if venv is not found
        
    print("=== Запуск локального NotebookLM ===")
    
    # Start Backend FastAPI Server
    print("Запуск FastAPI Backend-сервера...")
    backend_process = subprocess.Popen(
        [venv_python, "main.py", "serve"],
        cwd=base_dir
    )
    
    # Give backend a moment to bind the port
    time.sleep(1.5)
    
    # Start Frontend React Server
    print("Запуск React Frontend-сервера...")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=os.path.join(base_dir, "frontend")
    )
    
    print("\nИнтерфейс доступен по ссылке: http://localhost:5173")
    print("Нажмите Ctrl+C для остановки обоих серверов.\n")
    
    try:
        while True:
            # Check if either process terminated unexpectedly
            if backend_process.poll() is not None:
                print("Процесс backend-сервера остановился.")
                break
            if frontend_process.poll() is not None:
                print("Процесс frontend-сервера остановился.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nПолучен сигнал остановки. Завершение работы серверов...")
    finally:
        # Terminate backend process
        if backend_process.poll() is None:
            try:
                backend_process.terminate()
                backend_process.wait(timeout=3)
                print("Backend-сервер успешно остановлен.")
            except Exception as e:
                print(f"Ошибка при остановке backend: {e}")
                
        # Terminate frontend process
        if frontend_process.poll() is None:
            try:
                frontend_process.terminate()
                frontend_process.wait(timeout=3)
                print("Frontend-сервер успешно остановлен.")
            except Exception as e:
                print(f"Ошибка при остановке frontend: {e}")
                
        print("Работа завершена.")

if __name__ == "__main__":
    main()
