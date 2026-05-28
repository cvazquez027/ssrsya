from playwright.sync_api import sync_playwright
import time
import os

def descargar_expediente_gde(usuario, password, numero_gde, carpeta_destino="descargas"):
    # Nos aseguramos de que exista la carpeta de descargas
    os.makedirs(carpeta_destino, exist_ok=True)

    with sync_playwright() as p:
        # Lanzamos el navegador. Cambiar headless=False para ver qué hace (modo debug)
        browser = p.chromium.launch(headless=False) 
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        print("[*] Accediendo a GDE...")
        page.goto("https://cas.gde.gob.ar/acceso/login/")

        # --- PASO 1: LOGIN ---
        # Usamos los placeholders porque los IDs (ej. pPQCl) cambian en cada sesión
        print("[*] Ingresando credenciales...")
        page.fill('input[placeholder="Usuario/Cuil/Cuit"]', usuario)
        page.fill('input[placeholder="Contraseña"]', password)
        
        # Hacemos clic en el botón de Acceder
        page.click('button:has-text("Acceder")')

        # Esperamos a que cargue el Escritorio Único (buscamos un elemento clave del header)
        print("[*] Esperando carga del Escritorio Único...")
        page.wait_for_selector('text="Gestión Documental Electrónica"', timeout=60000)

        # --- PASO 2: BÚSQUEDA DEL EXPEDIENTE ---
        print(f"[*] Buscando expediente: {numero_gde}")
        page.fill('input[placeholder="Ingrese el número GDE"]', numero_gde)
        page.click('button[title="Buscar"]')

        print("[*] Esperando resultados en la grilla...")
        # 1. Aislamos la fila EXACTA de la tabla
        fila_expediente = page.locator(f'tr:has-text("{numero_gde}")').first
        fila_expediente.wait_for(state="visible", timeout=30000)

        # ---------------------------------------------------------
        # EL TRUCO DEL COMBOBOX (Basado en el HTML real de GDE)
        # ---------------------------------------------------------
        print("[*] Haciendo clic en la flechita del menú...")
        # 2. Apuntamos a la etiqueta <a> exacta que oficia de botón
        boton_flechita = fila_expediente.locator('a.z-combobox-button').first
        boton_flechita.click(force=True)

        # 3. Le damos 1 segundo clavado para que la animación de ZK despliegue el ul/li
        page.wait_for_timeout(1000)

        print("[*] Seleccionando la opción 'Visualizar'...")
        # 4. Buscamos el ítem de la lista <li> que contiene el span con nuestro texto
        opcion_visualizar = page.locator('li.z-comboitem:has(span.z-comboitem-text:text-is("Visualizar")):visible').first
        
        # Hacemos clic forzado por si ZK le pone alguna capa transparente encima
        opcion_visualizar.click(force=True)
        # ---------------------------------------------------------

        # --- PASO 3: DESCARGA ---
        # Esperamos a que el modal se abra y el botón de descarga exista en el DOM
        print("[*] Preparando descarga...")
        selector_descarga = 'button:has-text("Descargar todos los Documentos")'
        page.wait_for_selector(selector_descarga)

        # Playwright maneja las descargas de forma asíncrona, hay que decirle que espere un evento
        with page.expect_download(timeout=120000) as download_info:
            page.click(selector_descarga)
        
        download = download_info.value
        
        # Guardamos el archivo en nuestra carpeta local
        ruta_archivo = os.path.join(carpeta_destino, f"{numero_gde}.zip") # O .pdf, según lo que devuelva GDE
        download.save_as(ruta_archivo)
        
        print(f"[+] ¡Éxito! Archivo guardado en: {ruta_archivo}")

        # Cerramos sesión (Buena práctica para no dejar sesiones colgadas en el servidor)
        page.click('span[title="Salir"]')
        page.wait_for_timeout(2000)
        
        browser.close()

# --- EJECUCIÓN ---
if __name__ == "__main__":
    USER = "CHDVAZQUEZ"
    PASS = "Tomi.130725"
    EXPEDIENTE = "EX-2026-01138970- -APN-DGD#MS"
    
    descargar_expediente_gde(USER, PASS, EXPEDIENTE)