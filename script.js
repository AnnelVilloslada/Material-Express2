// Variables globales
let categorias = []
let materiales = []
let proveedores = []
let currentUser = null
let selectedMaterialId = null
let selectedMaterials = [] // Para cotización múltiple
let registeredUsers = [] // Base de datos local de usuarios registrados
const modal = document.getElementById("quote-modal")
const multiQuoteModal = document.getElementById("multi-quote-modal")

// URL de tu Google Apps Script
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzqkNCJRmZ6NYrD6FBu6GEz9QAU_nDNZnglgGkJ9C9em9jMJSlABx8ojh0xaJEf269RHg/exec"

// Elementos del DOM
const authContainer = document.getElementById("auth-container")
const loginContainer = document.getElementById("login-container")
const registerContainer = document.getElementById("register-container")
const mainContainer = document.getElementById("main-container")
const resultsContainer = document.getElementById("results-container")
const notification = document.getElementById("notification")
const categoriesList = document.getElementById("categories-list")
const materialsList = document.getElementById("materials-list")

// ================= FUNCIONES DE AUTENTICACIÓN ================= //

// Función para cargar usuarios registrados desde localStorage
function loadRegisteredUsers() {
  const stored = localStorage.getItem("materialExpressUsers")
  if (stored) {
    registeredUsers = JSON.parse(stored)
  }
}

// Función para guardar usuarios registrados en localStorage
function saveRegisteredUsers() {
  localStorage.setItem("materialExpressUsers", JSON.stringify(registeredUsers))
}

// Función para verificar si un usuario está registrado
function isUserRegistered(email, password) {
  return registeredUsers.find((user) => user.email.toLowerCase() === email.toLowerCase() && user.password === password)
}

// Función para registrar un nuevo usuario
function registerUser(userData) {
  // Verificar si el email ya existe
  const existingUser = registeredUsers.find((user) => user.email.toLowerCase() === userData.email.toLowerCase())

  if (existingUser) {
    return { success: false, message: "Este correo electrónico ya está registrado" }
  }

  // Verificar si el username ya existe
  const existingUsername = registeredUsers.find(
    (user) => user.username.toLowerCase() === userData.username.toLowerCase(),
  )

  if (existingUsername) {
    return { success: false, message: "Este nombre de usuario ya está en uso" }
  }

  // Agregar el nuevo usuario
  const newUser = {
    id: Date.now(),
    name: userData.name,
    username: userData.username,
    email: userData.email,
    phone: userData.phone,
    password: userData.password,
    registeredAt: new Date().toISOString(),
  }

  registeredUsers.push(newUser)
  saveRegisteredUsers()

  return { success: true, user: newUser }
}

// Función para actualizar el perfil del usuario en la interfaz
function updateUserProfile(user) {
  const userDisplayName = document.getElementById("user-display-name")
  if (userDisplayName) {
    userDisplayName.textContent = user.name || user.username || "Usuario"
  }
}

// ================= FUNCIONES PRINCIPALES ================= //

// Función para mostrar/ocultar contenedores
function showAuth() {
  authContainer.style.display = "block"
  loginContainer.style.display = "none"
  registerContainer.style.display = "none"
  mainContainer.style.display = "none"
  resultsContainer.style.display = "none"
}

function showLogin() {
  authContainer.style.display = "none"
  loginContainer.style.display = "block"
  registerContainer.style.display = "none"
  mainContainer.style.display = "none"
  resultsContainer.style.display = "none"
}

function showRegister() {
  authContainer.style.display = "none"
  loginContainer.style.display = "none"
  registerContainer.style.display = "block"
  mainContainer.style.display = "none"
  resultsContainer.style.display = "none"
}

function showMain() {
  authContainer.style.display = "none"
  loginContainer.style.display = "none"
  registerContainer.style.display = "none"
  mainContainer.style.display = "block"
  resultsContainer.style.display = "none"
  loadCategories()
  updateUserProfile(currentUser)
}

function showResults() {
  authContainer.style.display = "none"
  loginContainer.style.display = "none"
  registerContainer.style.display = "none"
  mainContainer.style.display = "none"
  resultsContainer.style.display = "block"
}

// Función para mostrar notificaciones
function showNotification(message, isError = false) {
  notification.textContent = message
  notification.style.display = "block"

  if (isError) {
    notification.classList.add("error")
  } else {
    notification.classList.remove("error")
  }

  setTimeout(() => {
    notification.style.display = "none"
  }, 3000)
}

// Función para cargar datos desde Google Sheets
async function loadDataFromSheet(sheetName) {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`)
    if (!response.ok) throw new Error("Error al cargar datos")
    const data = await response.json()

    if (!Array.isArray(data)) {
      throw new Error("Formato de datos incorrecto")
    }

    // Si estamos cargando proveedores, verificar que tengan el método de entrega
    if (sheetName === "Proveedores") {
      console.log("Datos de proveedores cargados:", data)
      // Verificar las diferentes variaciones del campo método de entrega
      data.forEach((provider, index) => {
        console.log(`Proveedor ${index}:`, {
          Método_Entrega: provider.Método_Entrega,
          Metodo_Entrega: provider.Metodo_Entrega,
          MetodoEntrega: provider.MetodoEntrega,
          "Método de Entrega": provider["Método de Entrega"],
          "Metodo de Entrega": provider["Metodo de Entrega"],
          metodo_entrega: provider.metodo_entrega,
          columna_I: provider.I, // Si la columna I se lee directamente
          todas_las_propiedades: Object.keys(provider),
        })
      })
    }

    return data
  } catch (error) {
    console.error(`Error al cargar ${sheetName}:`, error)
    showNotification(`Error al cargar ${sheetName}`, true)
    return []
  }
}

// Función para obtener el método de entrega de un proveedor
function getMetodoEntrega(provider) {
  // Intentar diferentes variaciones del campo método de entrega
  return (
    provider.Método_Entrega ||
    provider.Metodo_Entrega ||
    provider.MetodoEntrega ||
    provider["Método de Entrega"] ||
    provider["Metodo de Entrega"] ||
    provider.metodo_entrega ||
    provider.I || // Si la columna I se lee directamente
    "No especificado"
  )
}

// Función para cargar todos los datos
async function loadData() {
  showNotification("Cargando datos...")

  try {
    const [catData, matData, provData] = await Promise.all([
      loadDataFromSheet("Categorías"),
      loadDataFromSheet("Materiales"),
      loadDataFromSheet("Proveedores"),
    ])

    categorias = catData
    materiales = matData
    proveedores = provData

    const categoryFilter = document.getElementById("category-filter")
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>'

    const multiCategoryFilter = document.getElementById("multi-category-filter")
    if (multiCategoryFilter) {
      multiCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>'
    }

    categorias.forEach((categoria) => {
      const option = document.createElement("option")
      option.value = categoria.ID.toString()
      option.textContent = categoria.Nombre
      categoryFilter.appendChild(option)

      if (multiCategoryFilter) {
        const multiOption = option.cloneNode(true)
        multiCategoryFilter.appendChild(multiOption)
      }
    })

    showNotification("Datos cargados correctamente")
    return true
  } catch (error) {
    console.error("Error al cargar datos:", error)
    showNotification("Error al cargar los datos. Inténtalo más tarde.", true)
    return false
  }
}

// Función para cargar categorías
function loadCategories() {
  const categoriesList = document.getElementById("categories-list")
  categoriesList.innerHTML = ""

  // Colores para las categorías
  const categoryColors = [
    { bg: "#E3F2FD", border: "#4361ee" }, // Azul
    { bg: "#FFF8E1", border: "#4895ef" }, // Celeste
    { bg: "#E8F5E9", border: "#4cc9f0" }, // Turquesa
    { bg: "#F3E5F5", border: "#3f37c9" }, // Morado
    { bg: "#FBE9E7", border: "#f72585" }, // Rosa
  ]

  categorias.forEach((categoria, index) => {
    const colorIndex = index % categoryColors.length
    const color = categoryColors[colorIndex]

    const categoryCard = document.createElement("div")
    categoryCard.className = "category-card"
    categoryCard.style.backgroundColor = color.bg
    categoryCard.style.borderTopColor = color.border

    // Agregar un icono según la categoría
    const iconClass = getIconForCategory(categoria.Nombre)

    categoryCard.innerHTML = `
      <i class="${iconClass}" style="font-size: 32px; color: ${color.border};"></i>
      <h3>${categoria.Nombre}</h3>
    `

    categoryCard.addEventListener("click", () => {
      loadMaterials(categoria.ID)
    })

    categoriesList.appendChild(categoryCard)
  })
}

// Función para obtener un icono según la categoría
function getIconForCategory(categoryName) {
  const name = categoryName.toLowerCase()

  if (name.includes("cemento") || name.includes("concreto")) return "fas fa-cubes"
  if (name.includes("madera")) return "fas fa-tree"
  if (name.includes("metal") || name.includes("acero")) return "fas fa-cog"
  if (name.includes("eléctrico") || name.includes("electrico")) return "fas fa-bolt"
  if (name.includes("pintura")) return "fas fa-paint-roller"
  if (name.includes("herramienta")) return "fas fa-tools"
  if (name.includes("plomería") || name.includes("plomeria")) return "fas fa-faucet"
  if (name.includes("vidrio")) return "fas fa-glass-martini"
  if (name.includes("techo") || name.includes("tejado")) return "fas fa-home"
  if (name.includes("limpieza")) return "fas fa-broom"

  // Icono por defecto
  return "fas fa-boxes-stacked"
}

// Función para cargar materiales según categoría seleccionada
function loadMaterials(categoryId) {
  const filteredMaterials = materiales.filter((material) => {
    return material.Categoría_ID.toString() === categoryId.toString()
  })

  materialsList.innerHTML = ""
  materialsList.style.display = "grid"
  categoriesList.style.display = "none"

  if (filteredMaterials.length === 0) {
    materialsList.innerHTML = '<p class="no-results">No se encontraron materiales en esta categoría.</p>'
    return
  }

  filteredMaterials.forEach((material) => {
    const categoria = categorias.find((cat) => cat.ID.toString() === material.Categoría_ID.toString())

    const materialCard = document.createElement("div")
    materialCard.className = "material-card"
    materialCard.innerHTML = `
      <h3>${material.Nombre || "Material sin nombre"}</h3>
      <p><strong>Categoría:</strong> ${categoria ? categoria.Nombre : "Sin categoría"}</p>
      <p>${material.Descripción || "Sin descripción"}</p>
    `

    materialCard.addEventListener("click", () => {
      selectedMaterialId = material.ID
      showMaterialProviders(material.ID)
    })

    materialsList.appendChild(materialCard)
  })
}

// Función para mostrar proveedores de un material
function showMaterialProviders(materialId) {
  const material = materiales.find((mat) => mat.ID.toString() === materialId.toString())

  if (!material) {
    showNotification("Material no encontrado", true)
    showMain()
    return
  }

  document.getElementById("material-title").textContent = material.Nombre || "Material desconocido"

  const filteredProviders = proveedores.filter((prov) => prov.Material_ID.toString() === materialId.toString())

  const providersList = document.getElementById("providers-list")
  providersList.innerHTML = ""

  if (filteredProviders.length === 0) {
    providersList.innerHTML = '<p class="no-results">No se encontraron proveedores para este material.</p>'
    showResults()
    return
  }

  filteredProviders.forEach((provider) => {
    const telefono = provider["Télefono"] || provider.Teléfono || ""
    const disponibilidad = provider.Disponibilidad || "No especificada"

    // Usar la función mejorada para obtener el método de entrega
    const metodoEntrega = getMetodoEntrega(provider)

    const providerCard = document.createElement("div")
    providerCard.className = "provider-card"
    providerCard.innerHTML = `
      <h3>${provider.Nombre_Proveedor || "Proveedor desconocido"}</h3>
      <p><strong>Dirección:</strong> ${provider.Dirección || "No disponible"}</p>
      <p><strong>Precio:</strong> S/ ${provider.Precio || "0.00"}</p>
      <p><strong>Disponibilidad:</strong> ${disponibilidad}</p>
      <p><strong>Método de entrega:</strong> ${metodoEntrega}</p>
      <div class="provider-actions">
        ${provider.Link ? `<button class="buy-btn" data-link="${provider.Link}"><i class="fas fa-shopping-cart"></i> Comprar</button>` : ""}
        ${telefono ? `<button class="call-btn" data-phone="${telefono}"><i class="fas fa-phone"></i> Llamar</button>` : ""}
        <button class="quote-btn" data-provider='${JSON.stringify(provider)}' data-material-id="${materialId}"><i class="fas fa-file-invoice"></i> Cotización</button>
      </div>
    `

    providersList.appendChild(providerCard)
  })

  showResults()
}

// Función para mostrar el modal de cotización
function showQuoteModal(materialId, provider) {
  const allProviders = proveedores.filter((p) => p.Material_ID.toString() === materialId.toString())

  const material = materiales.find((m) => m.ID.toString() === materialId.toString())

  const materialName = material ? material.Nombre : "Material desconocido"

  // Calcular el total de precios
  let totalPrecio = 0
  allProviders.forEach((prov) => {
    const precio = Number.parseFloat(prov.Precio) || 0
    totalPrecio += precio
  })

  const quoteContent = document.getElementById("quote-content")
  quoteContent.innerHTML = `
    <h3>${materialName}</h3>
    <table class="quote-table">
      <thead>
        <tr>
          <th>Proveedor</th>
          <th>Precio (S/)</th>
          <th>Disponibilidad</th>
          <th>Método de Entrega</th>
          <th>Teléfono</th>
        </tr>
      </thead>
      <tbody>
        ${allProviders
          .map(
            (prov) => `
          <tr>
            <td>${prov.Nombre_Proveedor || "N/A"}</td>
            <td>S/ ${prov.Precio || "0.00"}</td>
            <td>${prov.Disponibilidad || "No especificada"}</td>
            <td>${getMetodoEntrega(prov)}</td>
            <td>${prov["Télefono"] || prov.Teléfono || "N/A"}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="1"><strong>Total</strong></td>
          <td><strong>S/ ${totalPrecio.toFixed(2)}</strong></td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>
  `

  // Configurar el botón de descarga PDF
  const downloadPdfBtn = document.getElementById("download-pdf")
  downloadPdfBtn.onclick = () => {
    generateAndDownloadPDF(materialName, allProviders, totalPrecio)
  }

  // Configurar el botón de descarga Excel
  const downloadExcelBtn = document.getElementById("download-excel")
  downloadExcelBtn.onclick = () => {
    generateAndDownloadExcel(materialName, allProviders, totalPrecio)
  }

  // Mostrar el modal
  modal.style.display = "block"

  // Generar y descargar PDF automáticamente al abrir el modal
  setTimeout(() => {
    generateAndDownloadPDF(materialName, allProviders, totalPrecio)
  }, 1000) // Aumentado el tiempo de espera para asegurar que las librerías estén cargadas
}

// Función mejorada para generar y descargar PDF automáticamente
function generateAndDownloadPDF(materialName, providers, totalPrecio) {
  try {
    const downloadPdfBtn = document.getElementById("download-pdf")
    if (downloadPdfBtn) {
      downloadPdfBtn.disabled = true
      downloadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...'
    }

    // Verificar que las librerías estén disponibles con múltiples intentos
    let jsPDFInstance = null

    // Intentar diferentes formas de acceder a jsPDF
    if (typeof window.jspdf !== "undefined" && window.jspdf.jsPDF) {
      jsPDFInstance = window.jspdf.jsPDF
    } else if (typeof window.jsPDF !== "undefined") {
      jsPDFInstance = window.jsPDF
    } else if (typeof jsPDF !== "undefined") {
      jsPDFInstance = jsPDF
    } else {
      throw new Error("La librería jsPDF no está disponible")
    }

    // Crear una instancia de jsPDF
    const doc = new jsPDFInstance()

    // Verificar que autoTable esté disponible
    if (typeof doc.autoTable !== "function") {
      throw new Error("La función autoTable no está disponible")
    }

    // Configurar fuente para caracteres especiales
    doc.setFont("helvetica")

    // Título
    doc.setFontSize(18)
    doc.text(`Cotización de material: ${materialName}`, 14, 20)

    // Fecha
    doc.setFontSize(12)
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-PE")}`, 14, 30)

    // Datos de la tabla
    const tableData = providers.map((provider) => [
      provider.Nombre_Proveedor || "N/A",
      provider.Precio ? `S/ ${provider.Precio}` : "S/ 0.00",
      provider.Disponibilidad || "No especificada",
      getMetodoEntrega(provider),
      provider["Télefono"] || provider.Teléfono || "N/A",
    ])

    // Agregar fila de total
    tableData.push(["TOTAL", `S/ ${totalPrecio.toFixed(2)}`, "", "", ""])

    // Generar la tabla
    doc.autoTable({
      head: [["Proveedor", "Precio (S/)", "Disponibilidad", "Método de Entrega", "Teléfono"]],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 10,
        cellPadding: 3,
        font: "helvetica",
      },
      headStyles: {
        fillColor: [67, 97, 238],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      didParseCell: (data) => {
        // Marcar la última fila (total) con estilo especial
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fillColor = [240, 240, 240]
          data.cell.styles.textColor = [0, 0, 0]
        }
      },
    })

    // Generar el nombre del archivo
    const filename = `Cotización_${materialName.replace(/[^a-z0-9]/gi, "_")}_${new Date().getTime()}.pdf`

    // Descargar el PDF usando el método save
    doc.save(filename)

    // Restaurar el botón
    if (downloadPdfBtn) {
      downloadPdfBtn.disabled = false
      downloadPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar PDF'
    }

    showNotification("PDF descargado correctamente")
  } catch (error) {
    console.error("Error al generar PDF:", error)
    showNotification("Error al generar el PDF: " + error.message, true)

    const downloadPdfBtn = document.getElementById("download-pdf")
    if (downloadPdfBtn) {
      downloadPdfBtn.disabled = false
      downloadPdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar PDF'
    }
  }
}

// Función para generar y descargar Excel
function generateAndDownloadExcel(materialName, providers, totalPrecio) {
  try {
    const downloadExcelBtn = document.getElementById("download-excel")
    downloadExcelBtn.disabled = true
    downloadExcelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando Excel...'

    // Verificar que XLSX esté disponible
    if (typeof XLSX === "undefined") {
      throw new Error("La librería XLSX no está disponible")
    }

    // Crear un libro de trabajo
    const wb = XLSX.utils.book_new()

    // Datos para la hoja de Excel
    const excelData = [
      ["Cotización de material: " + materialName],
      ["Fecha: " + new Date().toLocaleDateString("es-PE")],
      [""],
      ["Proveedor", "Precio (S/)", "Disponibilidad", "Método de Entrega", "Teléfono"],
    ]

    // Agregar datos de proveedores
    providers.forEach((provider) => {
      excelData.push([
        provider.Nombre_Proveedor || "N/A",
        provider.Precio ? `S/ ${provider.Precio}` : "S/ 0.00",
        provider.Disponibilidad || "No especificada",
        getMetodoEntrega(provider),
        provider["Télefono"] || provider.Teléfono || "N/A",
      ])
    })

    // Agregar fila de total
    excelData.push(["Total", `S/ ${totalPrecio.toFixed(2)}`, "", "", ""])

    // Crear hoja de trabajo
    const ws = XLSX.utils.aoa_to_sheet(excelData)

    // Definir el ancho de las columnas
    ws["!cols"] = [
      { wch: 20 }, // Proveedor
      { wch: 15 }, // Precio
      { wch: 20 }, // Disponibilidad
      { wch: 20 }, // Método de Entrega
      { wch: 15 }, // Teléfono
    ]

    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, "Cotización")

    // Guardar el archivo
    const filename = `Cotización_${materialName.replace(/[^a-z0-9]/gi, "_")}_${new Date().getTime()}.xlsx`
    XLSX.writeFile(wb, filename)

    showNotification("Excel descargado correctamente")
  } catch (error) {
    console.error("Error al generar Excel:", error)
    showNotification("Error al generar el Excel: " + error.message, true)
  } finally {
    const downloadExcelBtn = document.getElementById("download-excel")
    downloadExcelBtn.disabled = false
    downloadExcelBtn.innerHTML = '<i class="fas fa-file-excel"></i> Descargar Excel'
  }
}

// Función para mostrar el modal de cotización múltiple
function showMultiQuoteModal() {
  // Limpiar selecciones previas
  selectedMaterials = []

  // Actualizar la lista de materiales disponibles
  updateMultiMaterialsList()

  // Actualizar la lista de materiales seleccionados
  updateSelectedMaterialsList()

  // Mostrar el modal
  multiQuoteModal.style.display = "block"
}

// Función para actualizar la lista de materiales disponibles para cotización múltiple
function updateMultiMaterialsList(categoryId = "") {
  const multiMaterialsList = document.getElementById("multi-materials-list")
  multiMaterialsList.innerHTML = ""

  let filteredMaterials = materiales

  // Filtrar por categoría si se especifica
  if (categoryId) {
    filteredMaterials = materiales.filter((material) => material.Categoría_ID.toString() === categoryId.toString())
  }

  if (filteredMaterials.length === 0) {
    multiMaterialsList.innerHTML = '<p class="no-results">No se encontraron materiales.</p>'
    return
  }

  filteredMaterials.forEach((material) => {
    const isSelected = selectedMaterials.some((m) => m.ID === material.ID)

    const materialItem = document.createElement("div")
    materialItem.className = "multi-material-item"
    materialItem.innerHTML = `
      <input type="checkbox" id="material-${material.ID}" ${isSelected ? "checked" : ""}>
      <label for="material-${material.ID}">${material.Nombre}</label>
    `

    materialItem.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        const checkbox = materialItem.querySelector('input[type="checkbox"]')
        checkbox.checked = !checkbox.checked
        toggleMaterialSelection(material, checkbox.checked)
      }
    })

    const checkbox = materialItem.querySelector('input[type="checkbox"]')
    checkbox.addEventListener("change", () => {
      toggleMaterialSelection(material, checkbox.checked)
    })

    multiMaterialsList.appendChild(materialItem)
  })
}

// Función para actualizar la lista de materiales seleccionados
function updateSelectedMaterialsList() {
  const selectedMaterialsList = document.getElementById("selected-materials")
  selectedMaterialsList.innerHTML = ""

  if (selectedMaterials.length === 0) {
    selectedMaterialsList.innerHTML = '<p class="no-results">No hay materiales seleccionados.</p>'
    document.getElementById("generate-multi-quote").disabled = true
    return
  }

  selectedMaterials.forEach((material) => {
    const materialItem = document.createElement("div")
    materialItem.className = "selected-material-item"
    materialItem.innerHTML = `
      <span>${material.Nombre}</span>
      <button class="remove-material" data-id="${material.ID}">
        <i class="fas fa-times"></i>
      </button>
    `

    selectedMaterialsList.appendChild(materialItem)
  })

  // Habilitar el botón de generar cotización
  document.getElementById("generate-multi-quote").disabled = false
}

// Función para alternar la selección de un material
function toggleMaterialSelection(material, isSelected) {
  if (isSelected) {
    // Agregar a la selección si no está ya
    if (!selectedMaterials.some((m) => m.ID === material.ID)) {
      selectedMaterials.push(material)
    }
  } else {
    // Quitar de la selección
    selectedMaterials = selectedMaterials.filter((m) => m.ID !== material.ID)
  }

  // Actualizar la lista de seleccionados
  updateSelectedMaterialsList()
}

// Función para generar cotización múltiple
function generateMultiQuote() {
  if (selectedMaterials.length === 0) {
    showNotification("No hay materiales seleccionados", true)
    return
  }

  // Obtener el formato seleccionado
  const formatOption = document.querySelector('input[name="format"]:checked').value

  // Preparar datos para la cotización múltiple
  const multiQuoteData = []
  let totalGeneral = 0

  selectedMaterials.forEach((material) => {
    const materialProviders = proveedores.filter((p) => p.Material_ID.toString() === material.ID.toString())

    if (materialProviders.length > 0) {
      let materialTotal = 0
      materialProviders.forEach((provider) => {
        const precio = Number.parseFloat(provider.Precio) || 0
        materialTotal += precio
      })

      multiQuoteData.push({
        material: material,
        providers: materialProviders,
        total: materialTotal,
      })

      totalGeneral += materialTotal
    }
  })

  // Generar y descargar según el formato seleccionado
  if (formatOption === "pdf" || formatOption === "both") {
    generateMultiQuotePDF(multiQuoteData, totalGeneral)
  }

  if (formatOption === "excel" || formatOption === "both") {
    generateMultiQuoteExcel(multiQuoteData, totalGeneral)
  }

  // Cerrar el modal
  multiQuoteModal.style.display = "none"
}

// Función corregida para generar Excel de cotización múltiple
function generateMultiQuoteExcel(multiQuoteData, totalGeneral) {
  try {
    showNotification("Generando Excel...", false)

    // Verificar que XLSX esté disponible
    if (typeof XLSX === "undefined") {
      throw new Error("La librería XLSX no está disponible")
    }

    // Crear un libro de trabajo
    const wb = XLSX.utils.book_new()

    // Crear datos para una sola tabla con todos los materiales
    const excelData = [
      ["Cotización múltiple de materiales"],
      [`Fecha: ${new Date().toLocaleDateString("es-PE")}`],
      [""],
      ["Material", "Proveedor", "Precio (S/)", "Disponibilidad", "Método de Entrega", "Teléfono"],
    ]

    // Agregar todos los proveedores de todos los materiales en una sola tabla
    multiQuoteData.forEach((item) => {
      item.providers.forEach((provider) => {
        excelData.push([
          item.material.Nombre,
          provider.Nombre_Proveedor || "N/A",
          provider.Precio ? `S/ ${provider.Precio}` : "S/ 0.00",
          provider.Disponibilidad || "No especificada",
          getMetodoEntrega(provider),
          provider["Télefono"] || provider.Teléfono || "N/A",
        ])
      })
    })

    // Agregar fila de total general
    excelData.push(["", "TOTAL GENERAL", `S/ ${totalGeneral.toFixed(2)}`, "", "", ""])

    // Crear hoja de trabajo
    const ws = XLSX.utils.aoa_to_sheet(excelData)

    // Definir el ancho de las columnas
    ws["!cols"] = [
      { wch: 25 }, // Material
      { wch: 20 }, // Proveedor
      { wch: 15 }, // Precio
      { wch: 20 }, // Disponibilidad
      { wch: 20 }, // Método de Entrega
      { wch: 15 }, // Teléfono
    ]

    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, "Cotización Múltiple")

    // Guardar el archivo
    const filename = `Cotización_Multiple_${new Date().getTime()}.xlsx`
    XLSX.writeFile(wb, filename)

    showNotification("Excel de cotización múltiple descargado correctamente")
  } catch (error) {
    console.error("Error al generar Excel múltiple:", error)
    showNotification("Error al generar el Excel de cotización múltiple: " + error.message, true)
  }
}

// Función corregida para generar PDF de cotización múltiple
function generateMultiQuotePDF(multiQuoteData, totalGeneral) {
  try {
    showNotification("Generando PDF...", false)

    // Verificar que las librerías estén disponibles
    let jsPDFInstance = null

    if (typeof window.jspdf !== "undefined" && window.jspdf.jsPDF) {
      jsPDFInstance = window.jspdf.jsPDF
    } else if (typeof window.jsPDF !== "undefined") {
      jsPDFInstance = window.jsPDF
    } else if (typeof jsPDF !== "undefined") {
      jsPDFInstance = jsPDF
    } else {
      throw new Error("La librería jsPDF no está disponible")
    }

    // Crear una instancia de jsPDF
    const doc = new jsPDFInstance()

    // Verificar que autoTable esté disponible
    if (typeof doc.autoTable !== "function") {
      throw new Error("La función autoTable no está disponible")
    }

    // Configurar fuente para caracteres especiales
    doc.setFont("helvetica")

    // Título
    doc.setFontSize(18)
    doc.text("Cotización múltiple de materiales", 14, 20)

    // Fecha
    doc.setFontSize(12)
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-PE")}`, 14, 30)

    // Crear datos para una sola tabla con todos los materiales
    const tableData = []

    // Agregar todos los proveedores de todos los materiales en una sola tabla
    multiQuoteData.forEach((item) => {
      item.providers.forEach((provider) => {
        tableData.push([
          item.material.Nombre,
          provider.Nombre_Proveedor || "N/A",
          provider.Precio ? `S/ ${provider.Precio}` : "S/ 0.00",
          provider.Disponibilidad || "No especificada",
          getMetodoEntrega(provider),
          provider["Télefono"] || provider.Teléfono || "N/A",
        ])
      })
    })

    // Agregar fila de total general
    tableData.push(["", "TOTAL GENERAL", `S/ ${totalGeneral.toFixed(2)}`, "", "", ""])

    // Generar la tabla única
    doc.autoTable({
      head: [["Material", "Proveedor", "Precio (S/)", "Disponibilidad", "Método de Entrega", "Teléfono"]],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 9,
        cellPadding: 2,
        font: "helvetica",
      },
      headStyles: {
        fillColor: [67, 97, 238],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Material
        1: { cellWidth: 30 }, // Proveedor
        2: { cellWidth: 20 }, // Precio
        3: { cellWidth: 25 }, // Disponibilidad
        4: { cellWidth: 30 }, // Método de Entrega
        5: { cellWidth: 25 }, // Teléfono
      },
      didParseCell: (data) => {
        // Marcar la última fila (total) con estilo especial
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fillColor = [240, 240, 240]
          data.cell.styles.textColor = [0, 0, 0]
          data.cell.styles.fontSize = 10
        }
      },
      margin: { top: 40, right: 14, bottom: 20, left: 14 },
    })

    // Guardar el PDF
    const filename = `Cotización_Multiple_${new Date().getTime()}.pdf`
    doc.save(filename)

    showNotification("PDF de cotización múltiple descargado correctamente")
  } catch (error) {
    console.error("Error al generar PDF múltiple:", error)
    showNotification("Error al generar el PDF de cotización múltiple: " + error.message, true)
  }
}

// Función para manejar clicks en los botones
function handleButtonClicks(e) {
  // Botón de llamar
  const callBtn = e.target.closest(".call-btn")
  if (callBtn) {
    const phone = callBtn.dataset.phone
    if (phone && phone.trim() !== "") {
      const cleanPhone = phone.replace(/[^\d+]/g, "")
      window.open(`tel:${cleanPhone}`)
    } else {
      showNotification("Número de teléfono no disponible", true)
    }
    return
  }

  // Botón de cotización
  const quoteBtn = e.target.closest(".quote-btn")
  if (quoteBtn) {
    const provider = JSON.parse(quoteBtn.dataset.provider)
    const materialId = quoteBtn.dataset.materialId
    showQuoteModal(materialId, provider)
    return
  }

  // Botón de compra
  const buyBtn = e.target.closest(".buy-btn")
  if (buyBtn) {
    const link = buyBtn.dataset.link
    if (link) window.open(link, "_blank")
    return
  }

  // Cerrar modal
  if (e.target.classList.contains("close-modal") || e.target === modal || e.target === multiQuoteModal) {
    modal.style.display = "none"
    multiQuoteModal.style.display = "none"
    return
  }

  // Botón de cotización múltiple
  if (e.target.closest("#multi-quote-btn")) {
    showMultiQuoteModal()
    return
  }

  // Botón de generar cotización múltiple
  if (e.target.closest("#generate-multi-quote")) {
    generateMultiQuote()
    return
  }

  // Botón de eliminar material de la selección
  const removeBtn = e.target.closest(".remove-material")
  if (removeBtn) {
    const materialId = removeBtn.dataset.id
    selectedMaterials = selectedMaterials.filter((m) => m.ID !== materialId)
    updateSelectedMaterialsList()
    updateMultiMaterialsList(document.getElementById("multi-category-filter").value)
    return
  }
}

// ================= EVENT LISTENERS ================= //

document.addEventListener("DOMContentLoaded", () => {
  // Cargar usuarios registrados al iniciar
  loadRegisteredUsers()

  // Esperar a que las librerías se carguen completamente
  let loadAttempts = 0
  const maxAttempts = 10

  function checkLibraries() {
    loadAttempts++

    // Verificar si las librerías están disponibles
    const jsPDFAvailable =
      typeof window.jspdf !== "undefined" || typeof window.jsPDF !== "undefined" || typeof jsPDF !== "undefined"
    const xlsxAvailable = typeof XLSX !== "undefined"

    if (jsPDFAvailable && xlsxAvailable) {
      console.log("Todas las librerías están cargadas correctamente")
      initializeApp()
    } else if (loadAttempts < maxAttempts) {
      console.log(`Intento ${loadAttempts}: Esperando que se carguen las librerías...`)
      setTimeout(checkLibraries, 500)
    } else {
      console.warn("Algunas librerías no se cargaron correctamente")
      showNotification("Advertencia: Algunas funciones pueden no estar disponibles", true)
      initializeApp()
    }
  }

  function initializeApp() {
    loadData().then((success) => {
      if (!success) {
        showNotification("Error al conectar con la base de datos", true)
      }
    })

    // Botones de autenticación
    document.getElementById("login-btn").addEventListener("click", showLogin)
    document.getElementById("register-btn").addEventListener("click", showRegister)

    // Botones de volver
    document.getElementById("back-to-auth").addEventListener("click", showAuth)
    document.getElementById("back-to-auth-from-register").addEventListener("click", showAuth)
    document.getElementById("back-to-materials").addEventListener("click", () => {
      materialsList.style.display = "none"
      categoriesList.style.display = "grid"
      showMain()
    })

    // Filtro de categorías
    document.getElementById("category-filter").addEventListener("change", (e) => {
      if (e.target.value === "") {
        materialsList.style.display = "none"
        categoriesList.style.display = "grid"
        loadCategories()
      } else {
        loadMaterials(e.target.value)
      }
    })

    // Filtro de categorías para cotización múltiple
    const multiCategoryFilter = document.getElementById("multi-category-filter")
    if (multiCategoryFilter) {
      multiCategoryFilter.addEventListener("change", (e) => {
        updateMultiMaterialsList(e.target.value)
      })
    }

    // Botón de logout
    document.getElementById("logout-btn").addEventListener("click", () => {
      currentUser = null
      showAuth()
      showNotification("Sesión cerrada correctamente")
    })

    // Formulario de login
    document.getElementById("login-form").addEventListener("submit", (e) => {
      e.preventDefault()
      const email = document.getElementById("login-email").value.trim()
      const password = document.getElementById("login-password").value.trim()

      if (!email || !password) {
        showNotification("Por favor completa todos los campos", true)
        return
      }

      // Verificar si el usuario está registrado
      const user = isUserRegistered(email, password)
      if (user) {
        currentUser = user
        showMain()
        showNotification(`¡Bienvenido de nuevo, ${user.name}!`)
      } else {
        showNotification("Credenciales incorrectas. Verifica tu email y contraseña.", true)
      }
    })

    // Formulario de registro
    document.getElementById("register-form").addEventListener("submit", (e) => {
      e.preventDefault()

      const name = document.getElementById("register-name").value.trim()
      const username = document.getElementById("register-username").value.trim()
      const email = document.getElementById("register-email").value.trim()
      const phone = document.getElementById("register-phone").value.trim()
      const password = document.getElementById("register-password").value.trim()
      const confirm = document.getElementById("register-confirm").value.trim()

      // Validaciones
      if (!name || !username || !email || !phone || !password || !confirm) {
        showNotification("Por favor completa todos los campos", true)
        return
      }

      if (password !== confirm) {
        showNotification("Las contraseñas no coinciden", true)
        return
      }

      if (password.length < 6) {
        showNotification("La contraseña debe tener al menos 6 caracteres", true)
        return
      }

      // Intentar registrar el usuario
      const result = registerUser({
        name,
        username,
        email,
        phone,
        password,
      })

      if (result.success) {
        currentUser = result.user
        showMain()
        showNotification(`¡Registro exitoso! Bienvenido, ${result.user.name}!`)
      } else {
        showNotification(result.message, true)
      }
    })

    // Manejador de clicks para todos los botones
    document.addEventListener("click", handleButtonClicks)
  }

  // Iniciar la verificación de librerías
  checkLibraries()
})
