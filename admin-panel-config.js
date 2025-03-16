// admin-panel-config.js - Script para la gestión de configuración del panel
import { auth, isUserHost, db, storage } from './firebase.js';
import { showNotification } from './admin-panel.js';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// Elementos DOM para configuración general
const configForm = document.getElementById('configForm');
const nombreSitioInput = document.getElementById('nombreSitio');
const logoSitioInput = document.getElementById('logoSitio');
const logoPreview = document.getElementById('logoPreview');
const colorPrimarioInput = document.getElementById('colorPrimario');
const descripcionSitioInput = document.getElementById('descripcionSitio');

// Elementos DOM para notificaciones y correos
const notificationsForm = document.getElementById('notificationsForm');
const emailAdminInput = document.getElementById('emailAdmin');

// Elementos DOM para seguridad
const securityForm = document.getElementById('securityForm');
const passwordActualInput = document.getElementById('passwordActual');
const passwordNuevaInput = document.getElementById('passwordNueva');
const passwordConfirmarInput = document.getElementById('passwordConfirmar');

// Elementos DOM para exportar/importar
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataBtn = document.getElementById('importDataBtn');
const backupCheckbox = document.getElementById('backupEnabled');

// Inicializar configuración
export async function initConfigManagement() {
    try {
        // Verificar si el usuario es host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            showNotification("No tienes permisos para gestionar la configuración", "error");
            return;
        }
        
        // Cargar configuración actual
        await loadCurrentConfig();
        
        // Configurar event listeners para los formularios
        setupConfigForm();
        setupNotificationsForm();
        setupSecurityForm();
        setupDataManagement();
        
    } catch (error) {
        console.error("Error al inicializar gestión de configuración:", error);
        showNotification("Error al cargar la configuración. Inténtalo de nuevo.", "error");
    }
}

// Cargar configuración actual
async function loadCurrentConfig() {
    try {
        // Verificar si existe documento de configuración
        const configRef = doc(db, "config", "site");
        const configSnap = await getDoc(configRef);
        
        let configData = {};
        
        if (configSnap.exists()) {
            configData = configSnap.data();
        } else {
            // Crear documento de configuración con valores por defecto
            configData = {
                siteName: "Dtowin Torneos",
                logoUrl: "dtowin.png",
                primaryColor: "#ff6b1a",
                siteDescription: "Plataforma oficial de torneos Dtowin. Participa, compite y gana puntos para escalar en el ranking.",
                adminEmail: "",
                notifications: {
                    newUsers: true,
                    tournamentRegistrations: true,
                    tournamentResults: true,
                    weeklyReports: false
                },
                automaticBackup: true,
                createdAt: new Date(),
                createdBy: auth.currentUser.uid
            };
            
            // No crear el documento aquí, se creará al guardar
        }
        
        // Llenar formulario de configuración general
        if (nombreSitioInput) nombreSitioInput.value = configData.siteName || "";
        if (colorPrimarioInput) colorPrimarioInput.value = configData.primaryColor || "#ff6b1a";
        if (descripcionSitioInput) descripcionSitioInput.value = configData.siteDescription || "";
        
        // Mostrar logo actual
        if (logoPreview && configData.logoUrl) {
            logoPreview.src = configData.logoUrl;
        }
        
        // Configuración de notificaciones
        if (emailAdminInput) emailAdminInput.value = configData.adminEmail || "";
        
        if (configData.notifications) {
            document.querySelectorAll('input[type="checkbox"][name^="notification-"]').forEach(checkbox => {
                const notificationType = checkbox.name.replace('notification-', '');
                checkbox.checked = configData.notifications[notificationType] || false;
            });
        }
        
        // Configuración de respaldo automático
        if (backupCheckbox) {
            backupCheckbox.checked = configData.automaticBackup || false;
        }
        
    } catch (error) {
        console.error("Error al cargar configuración actual:", error);
        throw error;
    }
}

// Configurar formulario de configuración general
function setupConfigForm() {
    if (!configForm) return;
    
    // Vista previa de logo
    if (logoSitioInput) {
        logoSitioInput.addEventListener('change', function() {
            if (this.files && this.files[0] && logoPreview) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    logoPreview.src = e.target.result;
                };
                
                reader.readAsDataURL(this.files[0]);
            }
        });
    }
    
    // Manejar envío del formulario
    configForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Obtener valores del formulario
            const siteName = nombreSitioInput ? nombreSitioInput.value.trim() : "";
            const primaryColor = colorPrimarioInput ? colorPrimarioInput.value : "#ff6b1a";
            const siteDescription = descripcionSitioInput ? descripcionSitioInput.value.trim() : "";
            
            // Validaciones básicas
            if (!siteName) {
                showNotification("El nombre del sitio es obligatorio", "error");
                return;
            }
            
            // Verificar si hay logo nuevo
            let logoUrl = logoPreview ? logoPreview.src : "dtowin.png";
            
            if (logoSitioInput && logoSitioInput.files && logoSitioInput.files[0]) {
                try {
                    // Subir logo a Storage
                    const logoFile = logoSitioInput.files[0];
                    const storageRef = ref(storage, `config/logo_${Date.now()}`);
                    
                    await uploadBytes(storageRef, logoFile);
                    logoUrl = await getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error("Error al subir logo:", uploadError);
                    showNotification("Error al subir el logo. Intenta de nuevo.", "error");
                    return;
                }
            }
            
            // Preparar datos para guardar
            const configData = {
                siteName,
                logoUrl,
                primaryColor,
                siteDescription,
                updatedAt: new Date(),
                updatedBy: auth.currentUser.uid
            };
            
            // Guardar en Firestore
            const configRef = doc(db, "config", "site");
            const configSnap = await getDoc(configRef);
            
            if (configSnap.exists()) {
                await updateDoc(configRef, configData);
            } else {
                // Añadir campos adicionales para creación
                configData.createdAt = new Date();
                configData.createdBy = auth.currentUser.uid;
                
                // Usar updateDoc con merge: true para crear el documento
                await updateDoc(configRef, configData, { merge: true });
            }
            
            showNotification("Configuración guardada correctamente", "success");
            
        } catch (error) {
            console.error("Error al guardar configuración:", error);
            showNotification("Error al guardar configuración. Intenta de nuevo.", "error");
        }
    });
}

// Configurar formulario de notificaciones
function setupNotificationsForm() {
    if (!notificationsForm) return;
    
    notificationsForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Obtener valores de checkboxes
            const notifications = {};
            
            document.querySelectorAll('input[type="checkbox"][name^="notification-"]').forEach(checkbox => {
                const notificationType = checkbox.name.replace('notification-', '');
                notifications[notificationType] = checkbox.checked;
            });
            
            // Obtener email de administrador
            const adminEmail = emailAdminInput ? emailAdminInput.value.trim() : "";
            
            // Validar email
            if (adminEmail && !isValidEmail(adminEmail)) {
                showNotification("El email del administrador no es válido", "error");
                return;
            }
            
            // Preparar datos para guardar
            const configData = {
                adminEmail,
                notifications,
                updatedAt: new Date(),
                updatedBy: auth.currentUser.uid
            };
            
            // Guardar en Firestore
            const configRef = doc(db, "config", "site");
            await updateDoc(configRef, configData, { merge: true });
            
            showNotification("Configuración de notificaciones guardada correctamente", "success");
            
        } catch (error) {
            console.error("Error al guardar configuración de notificaciones:", error);
            showNotification("Error al guardar configuración. Intenta de nuevo.", "error");
        }
    });
}

// Configurar formulario de seguridad
function setupSecurityForm() {
    if (!securityForm) return;
    
    securityForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Obtener valores del formulario
            const currentPassword = passwordActualInput ? passwordActualInput.value : "";
            const newPassword = passwordNuevaInput ? passwordNuevaInput.value : "";
            const confirmPassword = passwordConfirmarInput ? passwordConfirmarInput.value : "";
            
            // Validaciones
            if (!currentPassword) {
                showNotification("La contraseña actual es obligatoria", "error");
                return;
            }
            
            if (!newPassword) {
                showNotification("La nueva contraseña es obligatoria", "error");
                return;
            }
            
            if (newPassword.length < 6) {
                showNotification("La contraseña debe tener al menos 6 caracteres", "error");
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showNotification("Las contraseñas no coinciden", "error");
                return;
            }
            
            // Cambiar contraseña
            // NOTA: Esto es un ejemplo, Firebase Auth tiene su propia forma de cambiar contraseñas
            // y típicamente requiere reautenticación. Implementar según necesidades específicas.
            showNotification("Funcionalidad de cambio de contraseña por implementar", "info");
            
            // Limpiar formulario
            securityForm.reset();
            
        } catch (error) {
            console.error("Error al cambiar contraseña:", error);
            showNotification("Error al cambiar contraseña. Intenta de nuevo.", "error");
        }
    });
}

// Configurar gestión de datos
function setupDataManagement() {
    // Exportar datos
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async function() {
            try {
                showNotification("Preparando exportación de datos...", "info");
                
                // Recopilar datos de las colecciones principales
                const data = {};
                
                // Obtener torneos
                const torneosRef = collection(db, "torneos");
                const torneosSnapshot = await getDocs(torneosRef);
                data.torneos = torneosSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Obtener badges
                const badgesRef = collection(db, "badges");
                const badgesSnapshot = await getDocs(badgesRef);
                data.badges = badgesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Obtener usuarios (sin información sensible)
                const usersRef = collection(db, "usuarios");
                const usersSnapshot = await getDocs(usersRef);
                data.usuarios = usersSnapshot.docs.map(doc => {
                    const userData = doc.data();
                    // Excluir datos sensibles
                    delete userData.token;
                    delete userData.recoveryEmail;
                    return {
                        id: doc.id,
                        ...userData
                    };
                });
                
                // Obtener resultados
                const resultadosRef = collection(db, "resultados");
                const resultadosSnapshot = await getDocs(resultadosRef);
                data.resultados = resultadosSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Crear blob y descargar
                const dataStr = JSON.stringify(data, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `dtowin_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                
                URL.revokeObjectURL(url);
                
                showNotification("Datos exportados correctamente", "success");
                
            } catch (error) {
                console.error("Error al exportar datos:", error);
                showNotification("Error al exportar datos. Intenta de nuevo.", "error");
            }
        });
    }
    
    // Importar datos
    if (importDataBtn) {
        importDataBtn.addEventListener('click', function() {
            // Crear input de archivo invisible
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'application/json';
            
            fileInput.addEventListener('change', async function() {
                if (this.files && this.files[0]) {
                    try {
                        const file = this.files[0];
                        
                        // Leer archivo
                        const reader = new FileReader();
                        
                        reader.onload = async function(e) {
                            try {
                                const data = JSON.parse(e.target.result);
                                
                                // Verificar estructura de datos
                                if (!data.torneos || !data.badges || !data.usuarios) {
                                    showNotification("El archivo no tiene el formato correcto", "error");
                                    return;
                                }
                                
                                // Confirmar importación
                                if (!confirm("Esta acción puede sobrescribir datos existentes. ¿Deseas continuar?")) {
                                    return;
                                }
                                
                                showNotification("Importando datos... No cierres la página.", "info");
                                
                                // Implementar lógica de importación
                                // NOTA: Este es un ejemplo simplificado. En un caso real se debería
                                // implementar una lógica más robusta para evitar sobreescrituras no deseadas.
                                showNotification("Funcionalidad de importación por implementar", "info");
                                
                            } catch (parseError) {
                                console.error("Error al parsear archivo:", parseError);
                                showNotification("Error al leer el archivo. Verifica que sea un JSON válido.", "error");
                            }
                        };
                        
                        reader.readAsText(file);
                        
                    } catch (error) {
                        console.error("Error al procesar archivo:", error);
                        showNotification("Error al procesar el archivo. Intenta de nuevo.", "error");
                    }
                }
            });
            
            // Disparar clic en el input
            fileInput.click();
        });
    }
    
    // Respaldo automático
    if (backupCheckbox) {
        backupCheckbox.addEventListener('change', async function() {
            try {
                // Guardar configuración de respaldo automático
                const configRef = doc(db, "config", "site");
                await updateDoc(configRef, {
                    automaticBackup: this.checked,
                    updatedAt: new Date(),
                    updatedBy: auth.currentUser.uid
                }, { merge: true });
                
                showNotification(`Respaldo automático ${this.checked ? 'activado' : 'desactivado'}`, "success");
                
            } catch (error) {
                console.error("Error al cambiar configuración de respaldo:", error);
                showNotification("Error al guardar configuración. Intenta de nuevo.", "error");
                // Restaurar estado del checkbox
                this.checked = !this.checked;
            }
        });
    }
}

// Función para validar email
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initConfigManagement);

// Exportar funciones
export {
    initConfigManagement
};
