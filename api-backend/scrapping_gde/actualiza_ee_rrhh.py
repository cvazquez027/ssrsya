import requests
from bs4 import BeautifulSoup
import re
import time
import gspread
import json

def consultar_expediente(anio, numero, reparticion):
    url_base = "https://www.argentina.gob.ar/formularios/consulta-de-expedientes"
    url_ajax = "https://www.argentina.gob.ar/system/ajax"
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': url_base,
        'Origin': 'https://www.argentina.gob.ar',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest' # Emulamos la petición AJAX
    })

    try:
        response_get = session.get(url_base, timeout=10)
    except Exception as e:
        return {"error": f"Error de conexión: {e}"}

    soup_get = BeautifulSoup(response_get.text, 'html.parser')
    
    formulario_gde = soup_get.find('form', id='argentinagobar-formularios-consulta-tad')
    if not formulario_gde:
        return {"error": "No se encontró el formulario de GDE en la página."}

    form_build_id_input = formulario_gde.find('input', {'name': 'form_build_id'})
    if not form_build_id_input:
        return {"error": "No se encontró el token de seguridad."}
    
    form_build_id = form_build_id_input['value']

    payload = {
        'anioExpediente': anio.strip(),
        'numeroExpediente': numero.strip(), 
        'codigoReparticion': reparticion.strip(),
        'form_build_id': form_build_id,
        'form_id': 'argentinagobar_formularios_consulta_tad',
        '_triggering_element_name': 'op',
        '_triggering_element_value': 'Enviar',
        'tarro_de_miel': ''  
    }

    try:
        response_post = session.post(url_ajax, data=payload, timeout=15)
    except Exception as e:
        return {"error": f"Error al enviar la consulta AJAX: {e}"}

    try:
        json_data = response_post.json()
    except ValueError:
        return {"error": "El servidor no devolvió el formato JSON esperado."}

    html_respuesta = ""
    for item in json_data:
        if item.get('command') == 'insert' and 'data' in item:
            html_respuesta = item['data']
            break

    if not html_respuesta:
        return {"error": "No se encontró el bloque de datos en la respuesta del servidor."}

    soup_post = BeautifulSoup(html_respuesta, 'html.parser')
    
    if not soup_post.find('h2', class_='table_title'):
        return {"error": "Expediente no encontrado en GDE."}

    tabla = soup_post.find('table', class_='table-striped')
    historial = []

    if tabla:
        filas = tabla.find('tbody').find_all('tr')
        for fila in filas:
            columnas = fila.find_all('td')
            if len(columnas) == 3:
                fecha = columnas[0].get_text(strip=True).replace('Fecha', '')
                emisor = columnas[1].get_text(strip=True).replace('Emisor', '')
                destino = columnas[2].get_text(strip=True).replace('Destino', '')
                historial.append({
                    "fecha": fecha.strip(),
                    "emisor": emisor.strip(),
                    "destino": destino.strip()
                })

    return {"historial": historial}

def actualizar_planilla():
    print("="*60)
    print(" ACTUALIZADOR MASIVO DE EXPEDIENTES GDE ")
    print("="*60)
    
    print("[*] Autenticando con Google Sheets...")
    try:
        gc = gspread.service_account(filename='credentials.json')
    except Exception as e:
        print(f"[!] Error al cargar credentials.json: {e}")
        return

    print("[*] Abriendo la hoja 'TRAMITES'...")
    # Asegurate de poner el link correcto que habías actualizado
    sheet_url = "https://docs.google.com/spreadsheets/d/1HskPywzGGK8_9CNFtHJshfskNgsazJuZiFlTbtPy0N4/edit"
    try:
        doc = gc.open_by_url(sheet_url)
        hoja = doc.worksheet("TRAMITES")
    except Exception as e:
        print(f"[!] No se pudo abrir la planilla. Error: {e}")
        return

    valores_gde = hoja.col_values(7) 
    patron = r"EX-(\d{4})-(\d+).*?-APN-(.+)"

    for i, exp_input in enumerate(valores_gde):
        fila_actual = i + 1 
        
        if fila_actual == 1 or not exp_input.strip():
            continue 
            
        match = re.search(patron, exp_input, re.IGNORECASE)
        if not match:
            print(f"[Fila {fila_actual}] Formato ignorado (no es un expediente válido): {exp_input}")
            continue
            
        anio, numero, reparticion = match.groups()
        print(f"\n[Fila {fila_actual}] Consultando: {exp_input.strip()}")
        
        resultado = consultar_expediente(anio, numero, reparticion)
        
        if "error" in resultado:
            print(f"   [!] {resultado['error']}")
        else:
            pases = resultado.get("historial", [])
            if pases:
                ultimo_pase = pases[0]
                
                partes_fecha = ultimo_pase['fecha'].split('-')
                fecha_formateada = f"{partes_fecha[0]}/{partes_fecha[1]}" if len(partes_fecha) >= 2 else ultimo_pase['fecha']
                
                destino = ultimo_pase['destino']
                ubicacion = destino if destino else ultimo_pase['emisor']

                hoja.update_cell(fila_actual, 8, fecha_formateada)
                hoja.update_cell(fila_actual, 9, ubicacion)
                print(f"   [+] Actualizado -> Fecha: {fecha_formateada} | Ubicación: {ubicacion}")
            else:
                print("   [!] Sin movimientos registrados.")
        
        time.sleep(2)

    print("\n[*] ¡Proceso finalizado con éxito!")

if __name__ == "__main__":
    actualizar_planilla()