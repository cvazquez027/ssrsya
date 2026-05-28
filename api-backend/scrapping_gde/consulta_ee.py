import requests
from bs4 import BeautifulSoup
import re
import json

def consultar_expediente(anio, numero, reparticion):
    url_base = "https://www.argentina.gob.ar/formularios/consulta-de-expedientes"
    url_ajax = "https://www.argentina.gob.ar/system/ajax"
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url_base,
        'Origin': 'https://www.argentina.gob.ar',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest' # Emulamos la petición AJAX
    })

    # 1. Obtener la página para sacar el token fresco
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

    # 2. Replicar el Payload exacto del navegador
    payload = {
        'anioExpediente': anio,
        'numeroExpediente': numero, 
        'codigoReparticion': reparticion,
        'form_build_id': form_build_id,
        'form_id': 'argentinagobar_formularios_consulta_tad',
        '_triggering_element_name': 'op',
        '_triggering_element_value': 'Enviar',
        'tarro_de_miel': ''  
    }

    # 3. Mandar el POST a la ruta AJAX
    try:
        response_post = session.post(url_ajax, data=payload, timeout=15)
    except Exception as e:
        return {"error": f"Error al enviar la consulta AJAX: {e}"}

    # 4. Parsear la respuesta JSON de Drupal
    try:
        json_data = response_post.json()
    except ValueError:
        return {"error": "El servidor no devolvió el formato JSON esperado."}

    # ==========================================
    # MODO DETECTIVE: Imprimir el JSON crudo
    # ==========================================
    print("\n" + "="*50)
    print(" 🕵️‍♂️ MODO DETECTIVE: RESPUESTA CRUDA DE LA API")
    print("="*50)
    print(json.dumps(json_data, indent=4, ensure_ascii=False))
    print("="*50 + "\n")
    # ==========================================

    # 5. Buscar el bloque de HTML dentro de la respuesta JSON
    html_respuesta = ""
    for item in json_data:
        # Drupal suele mandar un comando 'insert' o 'replaceWith' con los resultados
        if item.get('command') == 'insert' and 'data' in item:
            html_respuesta = item['data']
            break

    if not html_respuesta:
        return {"error": "No se encontró el bloque de datos en la respuesta del servidor. Verificá los datos ingresados."}

    # 6. Parseamos el HTML que vino adentro del JSON
    soup_post = BeautifulSoup(html_respuesta, 'html.parser')
    
    if not soup_post.find('h2', class_='table_title'):
        return {"error": "El expediente no existe o no tiene datos públicos."}

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

def main():
    print("="*70)
    print(" CONSULTOR DE EXPEDIENTES GDE - MINISTERIO DE SALUD")
    print("="*70)
    
    exp_input = input("Ingresá el expediente completo: ").strip()
    
    patron = r"EX-(\d{4})-(\d+).*?-APN-(.+)"
    match = re.search(patron, exp_input, re.IGNORECASE)
    
    if not match:
        print("\n[!] Formato inválido. Ejemplo: EX-2026-01138970- -APN-DGD#MS")
        return
        
    anio, numero, reparticion = match.groups()
    
    print(f"\n[i] Buscando: Año {anio} | Número {numero} | Repartición {reparticion}")
    print("[...] Emulando petición AJAX a Drupal...\n")
    
    resultado = consultar_expediente(anio, numero, reparticion)
    
    if "error" in resultado:
        print(f"[!] {resultado['error']}")
    else:
        pases = resultado.get("historial", [])
        if not pases:
            print("[!] El expediente se encontró, pero no registra pases.")
        else:
            print(f"--- HISTORIAL DE MOVIMIENTOS ({len(pases)}) ---")
            print(f"{'FECHA':<12} | {'EMISOR':<25} | {'DESTINO':<25}")
            print("-" * 68)
            for pase in pases:
                emisor = (pase['emisor'][:22] + '..') if len(pase['emisor']) > 24 else pase['emisor']
                destino = (pase['destino'][:22] + '..') if len(pase['destino']) > 24 else pase['destino']
                print(f"{pase['fecha']:<12} | {emisor:<25} | {destino:<25}")
            print("-" * 68)

if __name__ == "__main__":
    main()