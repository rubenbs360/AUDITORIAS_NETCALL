// app.js - Lógica del Portal de Auditorías y Calidad

// ========================================================
// CONFIGURACIÓN GLOBAL - ¡Modifica aquí tus URLs!
// ========================================================
// Reemplaza con la URL que te dará Google Apps Script al implementar como "Web App"
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyVoEyabbadrOSijRcLSaxIxjOd815dtxY-f0US6ljkRUg3GrfKvMN7VfW9LOAEHzs/exec"; 

// Reemplaza con tu enlace de hoja de cálculo compartida en formato exportación CSV
// gid=0 es la pestaña 'Auditorias'
const CSV_URL_AUDITS = "https://docs.google.com/spreadsheets/d/1wAmkSprEeZ_T-gx-nYhdliR2FmHr_wnZFQLupYogfPc/export?format=csv&gid=0";

// Cambia el gid por el de tu pestaña de 'Nomina' (el de tu hoja NOMINA es 5942816)
const CSV_URL_NOMINA = "https://docs.google.com/spreadsheets/d/1wAmkSprEeZ_T-gx-nYhdliR2FmHr_wnZFQLupYogfPc/export?format=csv&gid=5942816"; 


// ========================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ========================================================
let currentTab = 'form';
let nominaData = [];       // Contiene la nómina de asesores
let auditsData = [];       // Contiene las auditorías registradas
let currentAdvisorMeta = null; // Metadatos del asesor buscado actualmente
let listSearchQuery = "";

// Cargar datos iniciales
document.addEventListener("DOMContentLoaded", () => {
    // Definir la fecha de hoy como valor por defecto en el formulario
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("audit-date").value = today;
    
    // Cargar bases de datos
    loadDatabase();
    
    // Restringir entrada a solo números y máximo 9 dígitos en el teléfono
    const callNumInput = document.getElementById("call-number");
    callNumInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 9);
    });
    
    // Inicializar opciones de responsabilidad
    handleCallTypeChange();
    
    // Configurar zona de arrastrar y pegar
    initUploadZone();
});

// Función para cambiar de pestaña (SPA)
function switchTab(tabId) {
    currentTab = tabId;
    
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-btn-${tabId}`).classList.add('active');
    
    // Actualizar paneles visibles
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Actualizar títulos
    const title = document.getElementById('page-title');
    const subtitle = document.getElementById('page-subtitle');
    
    if (tabId === 'form') {
        title.innerText = "Realizar Auditoría de Calidad";
        subtitle.innerText = "Evaluación en tiempo real del speech y procesos de ventas outbound";
    } else if (tabId === 'dashboard') {
        title.innerText = "Dashboard de KPIs de Calidad";
        subtitle.innerText = "Indicadores consolidados, ratios de cumplimiento y ranking de supervisión";
        renderDashboard();
    } else if (tabId === 'list') {
        title.innerText = "Historial Detallado de Auditorías";
        subtitle.innerText = "Listado completo de evaluaciones registradas en base de datos";
        renderListTab();
    }
}

// ========================================================
// CARGA Y PARSEO DE GOOGLE SHEETS
// ========================================================
async function loadDatabase() {
    const statusBadge = document.getElementById("sheet-status");
    try {
        statusBadge.innerText = "● Sincronizando...";
        statusBadge.style.color = "#f59e0b"; // Naranja

        // 1. Cargar la Nómina
        const resNomina = await fetch(CSV_URL_NOMINA);
        if (resNomina.ok) {
            const rawCsv = await resNomina.text();
            nominaData = parseCSV(rawCsv);
            console.log("Nómina cargada:", nominaData.length, "registros");
        } else {
            console.warn("No se pudo leer la pestaña Nómina. Verifica la URL y permisos.");
        }

        // 2. Cargar las Auditorías
        const resAudits = await fetch(CSV_URL_AUDITS);
        if (resAudits.ok) {
            const rawCsv = await resAudits.text();
            auditsData = parseCSV(rawCsv);
            console.log("Auditorías cargadas:", auditsData.length, "registros");
        }

        statusBadge.innerText = "● Sincronizado";
        statusBadge.style.color = "var(--primary)"; // Verde
    } catch (e) {
        console.error("Error sincronizando con Google Sheets:", e);
        statusBadge.innerText = "● Desconectado";
        statusBadge.style.color = "var(--red)"; // Rojo
    }
}

// Analizador de CSV compatible con comillas, saltos de línea y comas internas
function parseCSV(text) {
    let lines = [];
    let row = [""];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i+1];
        
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') { i++; }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') {
        lines.push(row);
    }
    
    // Mapear filas a objetos (usando la cabecera en fila index 0)
    if (lines.length === 0) return [];
    
    const headers = lines[0].map(h => h.trim().toLowerCase().replace(/['"¿?]/g, '').replace(/[°]/g, ''));
    
    let objectList = [];
    for (let i = 1; i < lines.length; i++) {
        let rowValues = lines[i];
        if (rowValues.length < headers.length) continue;
        
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = rowValues[j] ? rowValues[j].trim() : "";
        }
        objectList.push(obj);
    }
    return objectList;
}

// ========================================================
// FORMULARIO: AUTOBÚSQUEDA Y AUTOCOMPLETADO DE ASESOR
// ========================================================

// Cerrar sugerencias al hacer clic afuera
document.addEventListener("click", (e) => {
    if (!e.target.closest(".relative-container")) {
        document.getElementById("dni-suggestions").classList.add("hidden");
        document.getElementById("name-suggestions").classList.add("hidden");
    }
});

function handleSearchInput(type) {
    const dniInput = document.getElementById("advisor-dni");
    const nameInput = document.getElementById("advisor-name");
    const dateInput = document.getElementById("audit-date").value;
    
    const query = type === 'dni' ? dniInput.value.trim() : nameInput.value.trim();
    const suggestionsBox = document.getElementById(type === 'dni' ? "dni-suggestions" : "name-suggestions");
    
    // Ocultar la otra caja
    document.getElementById(type === 'dni' ? "name-suggestions" : "dni-suggestions").classList.add("hidden");
    
    if (query.length < 2 || !dateInput) {
        suggestionsBox.classList.add("hidden");
        return;
    }
    
    // Filtrar asesores que coincidan con la búsqueda
    let matchedAdvisors = [];
    let seen = new Set();
    
    nominaData.forEach(item => {
        const itemDni = String(item.documento || "").trim();
        const itemName = String(item.nombre || "").trim();
        
        // Omitir si ya lo vimos en esta búsqueda
        const uniqueKey = `${itemDni}|${itemName}`;
        if (seen.has(uniqueKey)) return;
        
        let matches = false;
        if (type === 'dni') {
            matches = itemDni.includes(query);
        } else {
            matches = itemName.toLowerCase().includes(query.toLowerCase());
        }
        
        if (matches) {
            seen.add(uniqueKey);
            matchedAdvisors.push(item);
        }
    });
    
    if (matchedAdvisors.length === 0) {
        suggestionsBox.innerHTML = `<div class="suggestion-item"><span class="suggestion-name">No se encontraron resultados</span></div>`;
        suggestionsBox.classList.remove("hidden");
        return;
    }
    
    // Ordenar y limitar a 8 resultados
    matchedAdvisors = matchedAdvisors.slice(0, 8);
    
    let html = "";
    matchedAdvisors.forEach(advisor => {
        const advisorDni = String(advisor.documento || "").trim();
        const advisorName = String(advisor.nombre || "").trim();
        const supervisor = String(advisor.sup || "").trim();
        
        html += `
            <div class="suggestion-item" onclick="selectAdvisor('${advisorDni}', '${dateInput}')">
                <span class="suggestion-name">${advisorName}</span>
                <span class="suggestion-sub">DNI: ${advisorDni} | Sup: ${supervisor}</span>
            </div>
        `;
    });
    
    suggestionsBox.innerHTML = html;
    suggestionsBox.classList.remove("hidden");
}

function selectAdvisor(dni, dateValue) {
    // Buscar el registro específico para el DNI y la Fecha en la nómina
    const matchingRecords = nominaData.filter(item => String(item.documento).trim() === dni);
    
    let finalRecord = null;
    const exactDateMatch = matchingRecords.find(item => {
        if (!item.fecha) return false;
        return item.fecha.split(" ")[0] === dateValue;
    });
    
    if (exactDateMatch) {
        finalRecord = exactDateMatch;
    } else {
        // Fallback al más reciente
        matchingRecords.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        finalRecord = matchingRecords[0];
    }
    
    if (finalRecord) {
        document.getElementById("advisor-dni").value = finalRecord.documento || "";
        document.getElementById("advisor-name").value = finalRecord.nombre || "";
        document.getElementById("advisor-supervisor").value = finalRecord.sup || "Sin Supervisor";
        document.getElementById("advisor-lider").value = finalRecord.lider || finalRecord.líder || "-";
        document.getElementById("advisor-antiguedad").value = finalRecord.antigüedad || finalRecord.antiguedad || "-";
        document.getElementById("advisor-cuartil").value = finalRecord.cuartil_inicio_mes || finalRecord["cuartil inicio mes"] || "-";
        document.getElementById("advisor-gestion").value = finalRecord.gestion || finalRecord.gestión || "-";
        
        currentAdvisorMeta = {
            lider: finalRecord.lider || finalRecord.líder || "-",
            antiguedad: finalRecord.antigüedad || finalRecord.antiguedad || "-",
            gestion: finalRecord.gestion || finalRecord.gestión || "-",
            subEstado: finalRecord.sub_estado_general || finalRecord["sub estado general"] || "-",
            cuartil: finalRecord.cuartil_inicio_mes || finalRecord["cuartil inicio mes"] || "-"
        };
    }
    
    // Ocultar cajas de sugerencias
    document.getElementById("dni-suggestions").classList.add("hidden");
    document.getElementById("name-suggestions").classList.add("hidden");
}

// Gatillar cuando cambia la fecha para reevaluar supervisor si los campos ya están llenos
function handleIdentityChange() {
    const dni = document.getElementById("advisor-dni").value.trim();
    const dateValue = document.getElementById("audit-date").value;
    if (dni && dateValue) {
        selectAdvisor(dni, dateValue);
    }
}

// Controlar campos condicionales y opciones basadas en el tipo de llamada
function handleCallTypeChange() {
    const callType = document.getElementById("call-type").value;
    const respSelect = document.getElementById("no-sale-responsibility");
    const deliverySection = document.getElementById("delivery-section");
    
    respSelect.innerHTML = ""; // Limpiar opciones
    
    if (callType === "Venta") {
        const opt = document.createElement("option");
        opt.value = "No aplica";
        opt.text = "No aplica (Venta)";
        respSelect.appendChild(opt);
        respSelect.value = "No aplica";
        respSelect.disabled = true;
        
        // Mostrar sección de entrega y resetear a Cumple por defecto
        deliverySection.classList.remove("hidden");
        document.getElementById("chk-entrega-direccion").value = "Cumple";
        document.getElementById("chk-entrega-horario").value = "Cumple";
        document.getElementById("chk-entrega-contacto").value = "Cumple";
        document.getElementById("chk-entrega-biometria").value = "Cumple";
    } else {
        const opt1 = document.createElement("option"); opt1.value = "Asesor"; opt1.text = "Asesor";
        const opt2 = document.createElement("option"); opt2.value = "Cliente"; opt2.text = "Cliente";
        const opt3 = document.createElement("option"); opt3.value = "Entel"; opt3.text = "Entel";
        respSelect.appendChild(opt1);
        respSelect.appendChild(opt2);
        respSelect.appendChild(opt3);
        respSelect.value = "Asesor";
        respSelect.disabled = false;
        
        // Ocultar sección de entrega y poner todo en No aplica
        deliverySection.classList.add("hidden");
        document.getElementById("chk-entrega-direccion").value = "No aplica";
        document.getElementById("chk-entrega-horario").value = "No aplica";
        document.getElementById("chk-entrega-contacto").value = "No aplica";
        document.getElementById("chk-entrega-biometria").value = "No aplica";
    }
}

// ========================================================
// GUARDAR AUDITORÍA (ENVÍO GOOGLE APPS SCRIPT)
// ========================================================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const alertBox = document.getElementById("form-alert");
    const submitBtn = document.getElementById("submit-btn");
    
    // Limpiar alertas previas
    alertBox.className = "alert hidden";
    
    // Obtener campos básicos
    const rawDate = document.getElementById("audit-date").value; // YYYY-MM-DD
    // Convertir fecha de YYYY-MM-DD a DD/MM para mantener la visualización que pide el usuario
    const [year, month, day] = rawDate.split("-");
    const formattedDate = `${day}/${month}`;
    
    const dni = document.getElementById("advisor-dni").value.trim();
    const name = document.getElementById("advisor-name").value.trim();
    const supervisor = document.getElementById("advisor-supervisor").value.trim();
    
    if (!name || name.includes("no encontrado")) {
        alertBox.innerText = "Por favor, ingrese un DNI válido que exista en la nómina.";
        alertBox.className = "alert error";
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    
    // Validar Número de llamada (Debe tener 9 dígitos y empezar con 9)
    const callNumber = document.getElementById("call-number").value.trim();
    if (callNumber.length !== 9 || !callNumber.startsWith('9')) {
        alertBox.innerText = "El N° Llamada / Teléfono Cliente debe tener exactamente 9 dígitos y comenzar con 9 (Ej: 941474586).";
        alertBox.className = "alert error";
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    
    // Deshabilitar botón para evitar doble submit
    submitBtn.disabled = true;
    submitBtn.innerText = "Guardando auditoría...";
    
    // Procesar archivo adjunto si existe (soporta archivos arrastrados, seleccionados o pegados)
    let fileBase64 = "";
    let fileName = "";
    let fileMimeType = "";
    
    if (uploadedFile) {
        const file = uploadedFile;
        fileName = file.name;
        fileMimeType = file.type;
        try {
            fileBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(",")[1]);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } catch (fileErr) {
            console.error("Error leyendo el archivo adjunto:", fileErr);
        }
    }
    
    // Estructurar el JSON de auditoría con los metadatos de nómina históricos y nuevos campos
    const payload = {
        fecha: formattedDate,
        supervisor: supervisor,
        nombreAsesor: name,
        dniAsesor: dni,
        numLlamada: document.getElementById("call-number").value.trim(),
        tipoLlamada: document.getElementById("call-type").value,
        // 10 Checklist Criterios
        presentacionSpeech: document.getElementById("chk-presentacion-speech").value,
        presentacionImpacto: document.getElementById("chk-presentacion-impacto").value,
        sondeo: document.getElementById("chk-sondeo").value,
        ofreceMultipedido: document.getElementById("chk-multipedido").value,
        rebate: document.getElementById("chk-rebate").value,
        cierre: document.getElementById("chk-cierre").value,
        escuchaActiva: document.getElementById("chk-escucha").value,
        actitudComercial: document.getElementById("chk-actitud").value,
        ofrecimiento: document.getElementById("chk-ofrecimiento").value,
        ofreceExpres: document.getElementById("chk-expres").value,
        
        // 4 Checklist Entrega (Ventas)
        entregaDireccion: document.getElementById("chk-entrega-direccion").value,
        entregaHorario: document.getElementById("chk-entrega-horario").value,
        entregaContacto: document.getElementById("chk-entrega-contacto").value,
        entregaBiometria: document.getElementById("chk-entrega-biometria").value,
        
        responsabilidad: document.getElementById("no-sale-responsibility").value,
        resumenLlamada: document.getElementById("call-summary").value.trim(),
        tipsMejora: document.getElementById("improvement-tips").value.trim(),
        urlCloud: document.getElementById("cloud-url").value.trim(),
        // Nuevos campos
        feedbackEmail: document.getElementById("feedback-email").value,
        adminSanction: document.getElementById("admin-sanction").value,
        fileName: fileName,
        fileMimeType: fileMimeType,
        fileBase64: fileBase64,
        // Metadatos históricos de la nómina
        lider: currentAdvisorMeta?.lider || "-",
        antiguedad: currentAdvisorMeta?.antiguedad || "-",
        gestion: currentAdvisorMeta?.gestion || "-",
        subEstado: currentAdvisorMeta?.subEstado || "-",
        cuartil: currentAdvisorMeta?.cuartil || "-"
    };
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // Requerido para llamadas básicas a Google Script sin preflights complejos
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        // Puesto que usamos no-cors, la respuesta retornará opaca.
        // Asumiremos éxito si no arrojó error de red.
        alertBox.innerText = "✓ Auditoría registrada con éxito en el Google Sheet unificado.";
        alertBox.className = "alert success";
        
        // Limpiar el formulario excepto la fecha y DNI
        document.getElementById("call-number").value = "";
        document.getElementById("call-type").value = "";
        document.getElementById("no-sale-responsibility").value = "No aplica";
        document.getElementById("call-summary").value = "";
        document.getElementById("improvement-tips").value = "";
        document.getElementById("cloud-url").value = "";
        document.getElementById("feedback-email").value = "No";
        document.getElementById("admin-sanction").value = "No aplica";
        
        // Limpiar el archivo adjunto/pegado de memoria y UI
        clearUploadedFile();
        
        // Ocultar sección de entrega al resetear
        document.getElementById("delivery-section").classList.add("hidden");
        
        // Volver a cargar la base de datos de Sheets para actualizar dashboard
        setTimeout(() => {
            loadDatabase();
        }, 1500);
        
    } catch (err) {
        console.error("Error al registrar auditoría:", err);
        alertBox.innerText = "Error al intentar conectar con el servidor de Google. Inténtelo nuevamente.";
        alertBox.className = "alert error";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Guardar Auditoría";
    }
}

// ========================================================
// RENDERIZADO: DASHBOARD DE KPIS
// ========================================================
function renderDashboard() {
    if (auditsData.length === 0) return;
    
    // Obtener filtros del formulario de dashboard
    const filterLid = document.getElementById("dash-filter-lider").value;
    const filterSup = document.getElementById("dash-filter-supervisor").value;
    const filterCuar = document.getElementById("dash-filter-cuartil").value;
    const filterAnt = document.getElementById("dash-filter-antiguedad").value;
    const dateStartVal = document.getElementById("dash-filter-date-start").value;
    const dateEndVal = document.getElementById("dash-filter-date-end").value;
    
    // 1. Población única de filtros dinámicos (solo la primera vez o si cambia la data)
    populateFilters();
    
    // 2. Filtrar los registros de auditorías
    let filtered = auditsData.filter(row => {
        // Normalizar los nombres de columnas
        const supVal = row.supervisor || "";
        const lidVal = row.lider || "";
        const cuarVal = row.cuartil || "";
        const antVal = row.antiguedad || row.antigüedad || "";
        
        if (filterLid !== 'TODOS' && lidVal !== filterLid) return false;
        if (filterSup !== 'TODOS' && supVal !== filterSup) return false;
        if (filterCuar !== 'TODOS' && cuarVal !== filterCuar) return false;
        if (filterAnt !== 'TODOS' && antVal !== filterAnt) return false;
        
        // Filtrar por rango de fechas (fecha viene en formato DD/MM)
        const dateVal = row["fecha auditoria"] || row.fecha_auditoria || row.fecha || "";
        if (dateVal) {
            const parts = dateVal.split("/");
            if (parts.length === 2) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // 0-indexed
                const auditDateObj = new Date(2026, month, day); // Asumimos año 2026
                
                if (dateStartVal) {
                    const startObj = new Date(dateStartVal + "T00:00:00");
                    if (auditDateObj < startObj) return false;
                }
                if (dateEndVal) {
                    const endObj = new Date(dateEndVal + "T23:59:59");
                    if (auditDateObj > endObj) return false;
                }
            }
        }
        
        return true;
    });
    
    // --- CÁLCULO DE KPIS ---
    const totalAudits = filtered.length;
    let salesCount = 0;
    let totalScoreSum = 0;
    let totalQuestionsEvaluated = 0;
    
    // Contadores para preguntas del checklist
    // Llaves normalizadas de preguntas del parser
    const criteriaKeys = [
        { key: 'presentacion - speech correcto', label: '1) Presentación: Speech Correcto' },
        { key: 'presentacion - genera impacto e interes', label: '2) Presentación: Impacto e Interés' },
        { key: 'sondeo - preguntas de necesidad', label: '3) Sondeo: Preguntas de necesidad' },
        { key: 'ofrece multipedido', label: '4) Ofrece Multipedido' },
        { key: 'rebate objeciones', label: '5) Rebate Objeciones' },
        { key: 'cierre - preguntas cerradas', label: '6) Cierre: Preguntas cerradas' },
        { key: 'asesor tiene escucha activa', label: '7) Asesor tiene escucha activa' },
        { key: 'actitud comercial', label: '8) Actitud Comercial' },
        { key: 'ofrecimiento direccionado', label: '9) Ofrecimiento Direccionado' },
        { key: 'ofrece express', label: '10) Ofrece Express' },
        // 4 Criterios de Entrega
        { key: 'valida direccion exacta', label: '11) Entrega: Dirección y Cobertura' },
        { key: 'alinea fecha y rango horario', label: '12) Entrega: Horario' },
        { key: 'solicita un numero telefonico', label: '13) Entrega: Teléfono Adicional' },
        { key: 'informa que se requiere dni fisico', label: '14) Entrega: DNI y Huella' }
    ];
    
    const criteriaCounters = {};
    criteriaKeys.forEach(crit => {
        criteriaCounters[crit.key] = { cumple: 0, total: 0 };
    });
    
    // Contadores de responsabilidad de no venta
    const respCounters = {};
    let totalNoSalesEvaluated = 0;
    let advisorNoSaleCount = 0;
    
    filtered.forEach(row => {
        // Ratio de ventas
        if (row["tipo de llamada"] === "Venta" || row["tipo_llamada"] === "Venta") {
            salesCount++;
        }
        
        // Cumplimiento general (Cuentan las preguntas donde el valor es 'Cumple' o 'No cumple')
        let rowScore = 0;
        let rowEvaluatedQuestions = 0;
        
        criteriaKeys.forEach(crit => {
            // Buscar la llave que más coincida
            let val = row[crit.key];
            if (val === undefined) {
                // Intento fallback si la cabecera difiere por caracteres especiales
                const actualKey = Object.keys(row).find(k => k.includes(crit.key.substring(0, 10)));
                val = actualKey ? row[actualKey] : "";
            }
            
            if (val === "Cumple") {
                criteriaCounters[crit.key].cumple++;
                criteriaCounters[crit.key].total++;
                rowScore++;
                rowEvaluatedQuestions++;
            } else if (val === "No cumple") {
                criteriaCounters[crit.key].total++;
                rowEvaluatedQuestions++;
            }
        });
        
        if (rowEvaluatedQuestions > 0) {
            totalScoreSum += (rowScore / rowEvaluatedQuestions);
            totalQuestionsEvaluated++;
        }
        
        // Responsabilidad
        const resp = row["responsabilidad- no venta"] || row["responsabilidad"] || "";
        if (resp && resp !== "No aplica") {
            respCounters[resp] = (respCounters[resp] || 0) + 1;
            totalNoSalesEvaluated++;
            if (resp === "Asesor") {
                advisorNoSaleCount++;
            }
        }
    });
    
    // --- ACTUALIZAR MÁSCARAS DE KPI EN PANTALLA ---
    document.getElementById("kpi-total-audits").innerText = totalAudits;
    
    const complianceAvg = totalQuestionsEvaluated > 0 ? (totalScoreSum / totalQuestionsEvaluated) * 100 : 0;
    document.getElementById("kpi-compliance-avg").innerText = `${complianceAvg.toFixed(1)}%`;
    
    const conversionRate = totalAudits > 0 ? (salesCount / totalAudits) * 100 : 0;
    document.getElementById("kpi-conversion-rate").innerText = `${conversionRate.toFixed(1)}%`;
    document.getElementById("kpi-subtext-sales").innerText = `${salesCount} Ventas de ${totalAudits} llamadas`;
    
    const criticaNoSale = totalNoSalesEvaluated > 0 ? (advisorNoSaleCount / totalNoSalesEvaluated) * 100 : 0;
    document.getElementById("kpi-no-sale-critica").innerText = `${criticaNoSale.toFixed(0)}%`;
    
    // --- GRÁFICOS / BARRAS DE CRITERIOS ---
    const criteriaListHtml = criteriaKeys.map(crit => {
        const data = criteriaCounters[crit.key];
        const percent = data.total > 0 ? (data.cumple / data.total) * 100 : 0;
        return `
            <div class="metric-row">
                <div class="metric-info">
                    <span class="metric-name">${crit.label}</span>
                    <span class="metric-percentage">${percent.toFixed(1)}% (${data.cumple}/${data.total})</span>
                </div>
                <div class="metric-bar-bg">
                    <div class="metric-bar-fill bg-primary" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById("criteria-metrics-list").innerHTML = criteriaListHtml;
    
    // --- GRÁFICOS / BARRAS DE RESPONSABILIDAD ---
    const sortedResp = Object.entries(respCounters).sort((a,b) => b[1] - a[1]);
    const respListHtml = sortedResp.map(([key, val]) => {
        const percent = totalNoSalesEvaluated > 0 ? (val / totalNoSalesEvaluated) * 100 : 0;
        return `
            <div class="resp-item">
                <div class="resp-item-info">
                    <span class="resp-item-title">${key}</span>
                    <span class="resp-item-count">${val} llamadas registradas</span>
                </div>
                <span class="resp-item-badge">${percent.toFixed(0)}%</span>
            </div>
        `;
    }).join('');
    document.getElementById("responsibility-list").innerHTML = respListHtml || '<p class="card-desc">No se registran objeciones o causas de no venta en este rango.</p>';
    
    // --- TABLA RANKING SUPERVISORES ---
    // Agrupar calidad por supervisor
    const supGroups = {};
    filtered.forEach(row => {
        const sup = row.supervisor || "Indefinido";
        const lid = row.lider || "-";
        
        if (!supGroups[sup]) {
            supGroups[sup] = { name: sup, lider: lid, total: 0, complianceSum: 0, complianceCount: 0, actitudCumple: 0, actitudTotal: 0, rebateCumple: 0, rebateTotal: 0 };
        }
        
        supGroups[sup].total++;
        
        // Calcular calidad individual de la fila
        let rowScore = 0;
        let rowEvaluatedQuestions = 0;
        criteriaKeys.forEach(crit => {
            let val = row[crit.key];
            if (val === undefined) {
                const actualKey = Object.keys(row).find(k => k.includes(crit.key.substring(0, 10)));
                val = actualKey ? row[actualKey] : "";
            }
            if (val === "Cumple") {
                rowScore++;
                rowEvaluatedQuestions++;
                
                // Indicadores específicos del ranking
                if (crit.key === 'actitud comercial') supGroups[sup].actitudCumple++;
                if (crit.key === 'rebate - realiza rebate de objecciones') supGroups[sup].rebateCumple++;
            } else if (val === "No cumple") {
                rowEvaluatedQuestions++;
            }
            
            if (val === "Cumple" || val === "No cumple") {
                if (crit.key === 'actitud comercial') supGroups[sup].actitudTotal++;
                if (crit.key === 'rebate - realiza rebate de objecciones') supGroups[sup].rebateTotal++;
            }
        });
        
        if (rowEvaluatedQuestions > 0) {
            supGroups[sup].complianceSum += (rowScore / rowEvaluatedQuestions);
            supGroups[sup].complianceCount++;
        }
    });
    
    const rankingTbody = document.getElementById("supervisor-ranking-tbody");
    rankingTbody.innerHTML = Object.values(supGroups)
        .sort((a,b) => (b.complianceSum/b.complianceCount) - (a.complianceSum/a.complianceCount))
        .map(sup => {
            const compAvg = sup.complianceCount > 0 ? (sup.complianceSum / sup.complianceCount) * 100 : 0;
            const actAvg = sup.actitudTotal > 0 ? (sup.actitudCumple / sup.actitudTotal) * 100 : 0;
            const rebAvg = sup.rebateTotal > 0 ? (sup.rebateCumple / sup.rebateTotal) * 100 : 0;
            
            return `
                <tr>
                    <td><strong>${sup.name}</strong></td>
                    <td>${sup.lider}</td>
                    <td>${sup.total} auditorías</td>
                    <td><span class="quality-badge ${compAvg >= 80 ? 'high' : compAvg >= 60 ? 'mid' : 'low'}">${compAvg.toFixed(1)}%</span></td>
                    <td>${actAvg.toFixed(0)}%</td>
                    <td>${rebAvg.toFixed(0)}%</td>
                </tr>
            `;
        }).join('');
        
    // --- TABLA CONTROL DIARIO Y TIPIFICACIÓN ---
    const controlGroups = {};
    
    // 1. Inicializar con todos los supervisores y líderes existentes en la Nómina (para que salgan con 0)
    const allSupervisorsFromNomina = {};
    nominaData.forEach(row => {
        const sup = row.sup || row.supervisor;
        const lid = row.lider || row.líder || "Sin Líder";
        if (sup) {
            allSupervisorsFromNomina[sup] = lid;
        }
    });
    
    Object.entries(allSupervisorsFromNomina).forEach(([sup, lid]) => {
        controlGroups[sup] = {
            name: sup,
            lider: lid,
            total: 0,
            venta: 0,
            noVenta: 0,
            errorAgente: 0,
            errorCliente: 0,
            errorEntel: 0
        };
    });
    
    // 2. Acumular datos de las auditorías filtradas
    filtered.forEach(row => {
        const sup = row.supervisor || "Indefinido";
        const lid = row.lider || "Sin Líder";
        
        if (!controlGroups[sup]) {
            controlGroups[sup] = {
                name: sup,
                lider: lid,
                total: 0,
                venta: 0,
                noVenta: 0,
                errorAgente: 0,
                errorCliente: 0,
                errorEntel: 0
            };
        }
        
        const grp = controlGroups[sup];
        grp.total++;
        
        const callType = row["tipo de llamada"] || row["tipo_llamada"] || "No venta";
        if (callType === "Venta") {
            grp.venta++;
        } else {
            grp.noVenta++;
        }
        
        const resp = String(row["responsabilidad"] || row["responsabilidad - no venta"] || "").trim().toLowerCase();
        if (resp === "asesor" || resp === "agente") {
            grp.errorAgente++;
        } else if (resp === "cliente") {
            grp.errorCliente++;
        } else if (resp === "entel") {
            grp.errorEntel++;
        }
    });
    
    // 3. Agrupar por Líder para renderizado jerárquico
    const leaderGroups = {};
    Object.values(controlGroups).forEach(sup => {
        const lid = sup.lider;
        if (!leaderGroups[lid]) {
            leaderGroups[lid] = {
                name: lid,
                total: 0,
                venta: 0,
                noVenta: 0,
                errorAgente: 0,
                errorCliente: 0,
                errorEntel: 0,
                supervisors: []
            };
        }
        
        const lg = leaderGroups[lid];
        lg.supervisors.push(sup);
        lg.total += sup.total;
        lg.venta += sup.venta;
        lg.noVenta += sup.noVenta;
        lg.errorAgente += sup.errorAgente;
        lg.errorCliente += sup.errorCliente;
        lg.errorEntel += sup.errorEntel;
    });
    
    const controlTbody = document.getElementById("supervisor-control-tbody");
    
    // Generar el HTML ordenando por líderes con mayor volumen
    let html = "";
    Object.values(leaderGroups)
        .sort((a, b) => b.total - a.total)
        .forEach(lg => {
            const lgVentaPct = lg.total > 0 ? (lg.venta / lg.total) * 100 : 0;
            const lgNoVentaPct = lg.total > 0 ? (lg.noVenta / lg.total) * 100 : 0;
            const lgAgentePct = lg.total > 0 ? (lg.errorAgente / lg.total) * 100 : 0;
            const lgClientePct = lg.total > 0 ? (lg.errorCliente / lg.total) * 100 : 0;
            const lgEntelPct = lg.total > 0 ? (lg.errorEntel / lg.total) * 100 : 0;
            
            // Fila del Líder (Header del grupo con estilo azulado de alta prioridad)
            html += `
                <tr class="leader-row" style="background: rgba(59, 130, 246, 0.08); font-weight: bold; color: var(--primary);">
                    <td colspan="2">▼ ${lg.name.toUpperCase()}</td>
                    <td>${lg.total} auditorías</td>
                    <td>${lg.total > 0 ? lgVentaPct.toFixed(0) + '%' : '-'}</td>
                    <td>${lg.total > 0 ? lgNoVentaPct.toFixed(0) + '%' : '-'}</td>
                    <td>${lg.total > 0 ? lgAgentePct.toFixed(0) + '%' : '-'}</td>
                    <td>${lg.total > 0 ? lgClientePct.toFixed(0) + '%' : '-'}</td>
                    <td>${lg.total > 0 ? lgEntelPct.toFixed(0) + '%' : '-'}</td>
                </tr>
            `;
            
            // Supervisores ordenados por volumen dentro de su líder
            lg.supervisors
                .sort((a, b) => b.total - a.total)
                .forEach(sup => {
                    const pctVenta = sup.total > 0 ? (sup.venta / sup.total) * 100 : 0;
                    const pctNoVenta = sup.total > 0 ? (sup.noVenta / sup.total) * 100 : 0;
                    const pctAgente = sup.total > 0 ? (sup.errorAgente / sup.total) * 100 : 0;
                    const pctCliente = sup.total > 0 ? (sup.errorCliente / sup.total) * 100 : 0;
                    const pctEntel = sup.total > 0 ? (sup.errorEntel / sup.total) * 100 : 0;
                    
                    html += `
                        <tr class="supervisor-row">
                            <td style="color: var(--text-muted); font-size: 13px; padding-left: 20px;">—</td>
                            <td style="padding-left: 15px;">${sup.name}</td>
                            <td><span style="font-weight: ${sup.total > 0 ? '600' : 'normal'}; color: ${sup.total === 0 ? 'var(--red)' : 'var(--text)'};">${sup.total} auditorías</span></td>
                            <td>${sup.total > 0 ? pctVenta.toFixed(0) + '%' : '-'}</td>
                            <td>${sup.total > 0 ? pctNoVenta.toFixed(0) + '%' : '-'}</td>
                            <td>${sup.total > 0 ? `<span class="resp-item-badge ${sup.errorAgente > 0 ? 'low' : ''}">${pctAgente.toFixed(0)}%</span>` : '-'}</td>
                            <td>${sup.total > 0 ? pctCliente.toFixed(0) + '%' : '-'}</td>
                            <td>${sup.total > 0 ? pctEntel.toFixed(0) + '%' : '-'}</td>
                        </tr>
                    `;
                });
        });
        
    controlTbody.innerHTML = html;
}

// Poblar selects de filtros del Dashboard
function populateFilters() {
    const filterLid = document.getElementById("dash-filter-lider");
    const filterSup = document.getElementById("dash-filter-supervisor");
    const filterCuar = document.getElementById("dash-filter-cuartil");
    const filterAnt = document.getElementById("dash-filter-antiguedad");
    
    // Guardar selección actual para no sobreescribirla
    const selectedLid = filterLid.value;
    const selectedSup = filterSup.value;
    const selectedCuar = filterCuar.value;
    const selectedAnt = filterAnt.value;
    
    // Conjuntos únicos
    const lideres = new Set();
    const supervisores = new Set();
    const cuartiles = new Set();
    const antiguedades = new Set();
    
    auditsData.forEach(row => {
        if (row.lider) lideres.add(row.lider);
        if (row.supervisor) supervisores.add(row.supervisor);
        if (row.cuartil) cuartiles.add(row.cuartil);
        const ant = row.antiguedad || row.antigüedad;
        if (ant) antiguedades.add(ant);
    });
    
    // Llenar selects
    fillSelect(filterLid, lideres, selectedLid, "Todos los Líderes");
    fillSelect(filterSup, supervisores, selectedSup, "Todos los Supervisores");
    fillSelect(filterCuar, cuartiles, selectedCuar, "Todos los Cuartiles");
    fillSelect(filterAnt, antiguedades, selectedAnt, "Todas las Antigüedades");
}

function fillSelect(selectElement, setValues, selectedValue, defaultText) {
    let html = `<option value="TODOS">${defaultText}</option>`;
    Array.from(setValues).sort().forEach(val => {
        html += `<option value="${val}" ${val === selectedValue ? 'selected' : ''}>${val}</option>`;
    });
    selectElement.innerHTML = html;
}

// ========================================================
// RENDERIZADO: LISTADO HISTÓRICO DE AUDITORÍAS
// ========================================================
function renderListTab() {
    const tbody = document.getElementById("list-tbody");
    
    // Filtrar auditorías por término de búsqueda
    let filtered = auditsData;
    if (listSearchQuery) {
        filtered = auditsData.filter(row => {
            const query = listSearchQuery.toLowerCase();
            return (
                (row["nombre asesor"] && row["nombre asesor"].toLowerCase().includes(query)) ||
                (row["dni asesor"] && row["dni asesor"].toLowerCase().includes(query)) ||
                (row.supervisor && row.supervisor.toLowerCase().includes(query)) ||
                (row.lider && row.lider.toLowerCase().includes(query))
            );
        });
    }
    
    tbody.innerHTML = filtered.map(row => {
        // Calcular calidad individual de la fila
        let cumpleCount = 0;
        let totalVal = 0;
        const criteriaKeys = [
            'presentacion - speech correcto', 'presentacion - genera impacto e interes', 
            'sondeo - preguntas de necesidad', 'ofrece multipedido',
            'rebate objeciones', 'cierre - preguntas cerradas', 
            'asesor tiene escucha activa', 'actitud comercial',
            'ofrecimiento direccionado', 'ofrece express',
            'valida direccion exacta', 'alinea fecha y rango horario',
            'solicita un numero telefonico', 'informa que se requiere dni fisico'
        ];
        
        criteriaKeys.forEach(key => {
            let val = row[key];
            if (val === undefined) {
                const actualKey = Object.keys(row).find(k => k.includes(key.substring(0, 10)));
                val = actualKey ? row[actualKey] : "";
            }
            if (val === "Cumple") { cumpleCount++; totalVal++; }
            else if (val === "No cumple") { totalVal++; }
        });
        
        const compliance = totalVal > 0 ? (cumpleCount / totalVal) * 100 : 0;
        const url = row["url cloud"] || row["url_cloud"] || "#";
        const callType = row["tipo de llamada"] || row["tipo_llamada"] || "No venta";
        
        const uploadTime = row["fecha registro"] || row.fecha_registro || "-";
        const auditDate = row["fecha auditoria"] || row.fecha_auditoria || row.fecha || "-";
        
        // Corregir llave normalizada de N°LLAMADA que se limpia a "nllamada" por los caracteres especiales
        const phoneNum = row.nllamada || row["nllamada"] || row["n° llamada"] || row["n°llamada"] || row["n_llamada"] || "-";
        
        // Crear enlaces: Purecloud y Evidencia de Drive (si existe)
        const driveUrl = row["documento adjunto"] || row.documento_adjunto || row["documento_adjunto"] || "";
        let linksHtml = `<a href="${url}" target="_blank" class="link-btn" style="display:inline-block; margin-bottom: 4px;">Ver Purecloud ↗</a>`;
        if (driveUrl && driveUrl.startsWith("http")) {
            linksHtml += `<a href="${driveUrl}" target="_blank" class="link-btn" style="background: var(--amber); display:inline-block;">Ver Evidencia ↗</a>`;
        }
        
        return `
            <tr>
                <td><strong>${auditDate}</strong><br><small style="color:var(--text-muted); font-size:11px">Registro: ${uploadTime}</small></td>
                <td>${row.supervisor || "-"}</td>
                <td>${row["nombre asesor"] || "-"}<br><small style="color:var(--text-muted)">DNI: ${row["dni asesor"] || "-"}</small></td>
                <td>${phoneNum}</td>
                <td><span style="color: ${callType === 'Venta' ? 'var(--primary)' : 'var(--text-muted)'}; font-weight:600">${callType}</span></td>
                <td><span class="quality-badge ${compliance >= 80 ? 'high' : compliance >= 60 ? 'mid' : 'low'}">${compliance.toFixed(0)}%</span></td>
                <td>${row.lider || "-"}</td>
                <td><span class="resp-item-badge">${row.cuartil || "-"}</span></td>
                <td>${linksHtml}</td>
            </tr>
        `;
    }).join('');
}

function handleListSearch() {
    listSearchQuery = document.getElementById("search-list-input").value;
    renderListTab();
}

// ========================================================
// FUNCIONES COMPLETAS DE CARGA DE ARCHIVOS (DROP Y pegar)
// ========================================================
let uploadedFile = null;

function initUploadZone() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("attachment-file");
    const dropZoneText = document.getElementById("drop-zone-text");
    const filePreviewContainer = document.getElementById("file-preview-container");
    const previewFileName = document.getElementById("preview-file-name");
    const removeFileBtn = document.getElementById("remove-file-btn");

    if (!dropZone) return;

    // Clic en la zona abre el selector de archivo
    dropZone.addEventListener("click", () => fileInput.click());

    // Eventos de arrastre
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("hover");
    });
    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("hover");
    });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("hover");
        if (e.dataTransfer.files.length > 0) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });

    // Evento de pegado (Ctrl+V) en cualquier parte del formulario
    window.addEventListener("paste", (e) => {
        if (currentTab !== 'form') return;
        
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                // Nombre automático con fecha/hora
                const name = `captura_pegada_${new Date().toISOString().slice(0,10)}_${Math.floor(Math.random()*1000)}.png`;
                const renamedFile = new File([file], name, { type: "image/png" });
                handleUploadedFile(renamedFile);
            }
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            handleUploadedFile(fileInput.files[0]);
        }
    });

    removeFileBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Evitar abrir selector al hacer clic en Quitar
        clearUploadedFile();
    });
}

function handleUploadedFile(file) {
    const dropZoneText = document.getElementById("drop-zone-text");
    const filePreviewContainer = document.getElementById("file-preview-container");
    const previewFileName = document.getElementById("preview-file-name");

    uploadedFile = file;
    dropZoneText.classList.add("hidden");
    filePreviewContainer.classList.remove("hidden");
    previewFileName.innerText = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

function removeHoverEffect() {
    const dropZone = document.getElementById("drop-zone");
    if (dropZone) dropZone.classList.remove("hover");
}

function clearUploadedFile() {
    const fileInput = document.getElementById("attachment-file");
    const dropZoneText = document.getElementById("drop-zone-text");
    const filePreviewContainer = document.getElementById("file-preview-container");
    const previewFileName = document.getElementById("preview-file-name");

    uploadedFile = null;
    fileInput.value = "";
    dropZoneText.classList.remove("hidden");
    filePreviewContainer.classList.add("hidden");
    previewFileName.innerText = "";
}
