export const supportedLocales = ['en', 'es', 'zh-CN', 'zh-TW'];
const storageKey = 'daily-todo-language';

// Each row contains English, Spanish, Simplified Chinese, and Traditional Chinese.
const entries = {
  appName: ['Daily Todo', 'Tareas diarias', '日常', '日常'],
  documentTitle: ['Daily Todo · Tasks & Calendar', 'Tareas diarias · Lista y calendario', '日常 · 待办与日历', '日常 · 待辦與日曆'],
  tagline: ['A little record of every day.', 'Un pequeño registro de cada día.', '把每一天，留在这里。', '把每一天，留在這裡。'],
  homeLabel: ['Daily Todo home', 'Inicio de Tareas diarias', '日常首页', '日常首頁'],
  navigationLabel: ['Main navigation', 'Navegación principal', '主导航', '主導覽'],
  newTask: ['New task', 'Nueva tarea', '新建待办', '新增待辦'],
  navTasks: ['Task list', 'Lista de tareas', '待办清单', '待辦清單'],
  navCalendar: ['Calendar', 'Calendario', '日历回顾', '日曆回顧'],
  exportData: ['Export data', 'Exportar datos', '数据导出', '匯出資料'],
  calendarTitle: ['Calendar', 'Calendario', '日历回顾', '日曆回顧'],
  calendarSubtitle: ['Choose a day to see its tasks.', 'Elige un día para ver sus tareas.', '点选一天，查看那天的待办。', '點選一天，查看那天的待辦。'],
  tasksTitle: ['Task list', 'Lista de tareas', '待办清单', '待辦清單'],
  tasksSubtitle: ['Write it down. Get it done. Cross it off.', 'Apúntalo. Hazlo. Táchalo.', '把要做的事写下来，完成一件，划掉一件。', '把要做的事寫下來，完成一件，劃掉一件。'],
  chooseMonth: ['Choose month and year', 'Elegir mes y año', '选择年月', '選擇年月'],
  previousMonth: ['Previous month', 'Mes anterior', '上个月', '上個月'],
  nextMonth: ['Next month', 'Mes siguiente', '下个月', '下個月'],
  today: ['Today', 'Hoy', '今天', '今天'],
  weekdayMon: ['Mon', 'lun', '一', '一'],
  weekdayTue: ['Tue', 'mar', '二', '二'],
  weekdayWed: ['Wed', 'mié', '三', '三'],
  weekdayThu: ['Thu', 'jue', '四', '四'],
  weekdayFri: ['Fri', 'vie', '五', '五'],
  weekdaySat: ['Sat', 'sáb', '六', '六'],
  weekdaySun: ['Sun', 'dom', '日', '日'],
  legendCompleted: ['Completed', 'Completadas', '有完成', '有完成'],
  legendPending: ['Pending', 'Pendientes', '有待办', '有待辦'],
  legendOverdue: ['Overdue', 'Vencidas', '有逾期', '有逾期'],
  calendarRegionLabel: ['Calendar and daily tasks', 'Calendario y tareas del día', '日历与当天待办', '日曆與當天待辦'],
  selectedDateLabel: ['Choose a date', 'Elegir una fecha', '选择日期', '選擇日期'],
  dayLoading: ['Loading…', 'Cargando…', '正在读取…', '正在讀取…'],
  dayProgressLabel: ['Daily task progress', 'Progreso de las tareas del día', '当天完成进度', '當天完成進度'],
  dayFooterToday: ['These tasks belong to today’s list.', 'Estas tareas pertenecen a la lista de hoy.', '这些任务属于今天的清单。', '這些任務屬於今天的清單。'],
  dayFooterPast: ['You can still check off or reschedule unfinished tasks here.', 'Aún puedes completar o reprogramar las tareas pendientes de este día.', '仍可在这里勾选或改期未完成的任务。', '仍可在這裏勾選或改期未完成的任務。'],
  dayFooterFuture: ['You can check off these tasks early.', 'Puedes completar estas tareas antes de la fecha asignada.', '这些任务可以提前勾选。', '這些任務可以提前勾選。'],
  tasksSectionTitle: ['Tasks', 'Tareas', '待办事项', '待辦事項'],
  quickAddLabel: ['Quickly add a task', 'Añadir una tarea rápidamente', '快速添加待办', '快速新增待辦'],
  quickAddPlaceholder: ['Something you want to do…', 'Algo que quieras hacer…', '写下一件想做的事…', '寫下一件想做的事…'],
  addTask: ['Add', 'Añadir', '添加', '新增'],
  listFooter: ['Tasks are grouped by date. Find completed tasks in the calendar.', 'Las tareas se agrupan por fecha. Consulta las completadas en el calendario.', '任务按日期分组，已完成的任务可在日历中回看。', '任務按日期分組，已完成的任務可在日曆中回看。'],
  noScript: ['Enable JavaScript to use tasks and the calendar.', 'Activa JavaScript para usar las tareas y el calendario.', '请启用 JavaScript 后使用待办和日历。', '請啟用 JavaScript 後使用待辦和日曆。'],
  taskTitleLabel: ['What do you want to do?', '¿Qué quieres hacer?', '要做什么', '要做甚麼'],
  taskTitlePlaceholder: ['For example: Read a chapter', 'Por ejemplo: Leer un capítulo', '例如：读完一章书', '例如：讀完一章書'],
  notesLabel: ['Notes', 'Notas', '补充说明', '補充說明'],
  insertChecklistItem: ['Insert checklist item', 'Insertar elemento de lista', '插入勾选项', '插入勾選項'],
  checklistItem: ['Checklist item', 'Elemento de lista', '勾选项', '勾選項'],
  optional: ['Optional', 'Opcional', '选填', '選填'],
  notesPlaceholder: ['Details, an address, or a note to yourself…', 'Detalles, una dirección o una nota para ti…', '写下细节、地址，或想留给自己的话…', '寫下細節、地址，或想留給自己的話…'],
  taskDateLabel: ['Task date', 'Fecha asignada', '任务日期', '任務日期'],
  cancel: ['Cancel', 'Cancelar', '取消', '取消'],
  saveTask: ['Save task', 'Guardar tarea', '保存待办', '儲存待辦'],
  closeDialog: ['Close', 'Cerrar', '关闭', '關閉'],
  deleteDialogTitle: ['Delete this task?', '¿Eliminar esta tarea?', '删除这条待办？', '刪除這條待辦？'],
  deleteDescription: ['Permanently delete this task and all its calendar history. This cannot be undone.', 'Se eliminarán permanentemente esta tarea y todo su historial del calendario. No se puede deshacer.', '将永久删除这条待办及其全部日历历史，无法撤销。', '將永久刪除這條待辦及其全部日曆歷史，無法復原。'],
  keepTask: ['Keep task', 'Conservar tarea', '继续保留', '繼續保留'],
  deleteTask: ['Delete', 'Eliminar', '删除', '刪除'],
  exportDialogTitle: ['Export data', 'Exportar datos', '导出数据', '匯出資料'],
  closeExport: ['Close export', 'Cerrar exportación', '关闭导出', '關閉匯出'],
  exportDescription: ['Includes all tasks and history. Your existing data will stay unchanged.', 'Incluye todas las tareas y su historial. Los datos actuales se conservan sin cambios.', '包含全部待办与历史记录，不会修改或清空现有数据。', '包含全部待辦與歷史記錄，不會修改或清空現有資料。'],
  exportFormatLabel: ['File format', 'Formato de archivo', '文件格式', '檔案格式'],
  ymlDefault: ['YML (default)', 'YML (predeterminado)', 'YML（默认）', 'YML（預設）'],
  jsonFormat: ['JSON', 'JSON', 'JSON', 'JSON'],
  chooseSaveLocation: ['Choose save location', 'Elegir dónde guardar', '选择保存位置', '選擇儲存位置'],
  exportFilename: ['File name: {filename}', 'Nombre: {filename}', '文件名：{filename}', '檔案名稱：{filename}'],
  downloadFormat: ['Download {format}', 'Descargar {format}', '下载 {format}', '下載 {format}'],
  exportPickerHint: ['Choose the folder and file name in the system save dialog.', 'Elige la carpeta y el nombre en la ventana del sistema.', '将在系统保存窗口中选择文件夹和文件名。', '將在系統儲存視窗中選擇資料夾和檔案名稱。'],
  exportDownloadHint: ['Your browser controls the download location. On iPhone, use Share → Save to Files after downloading to choose a location.', 'El navegador decide dónde descargar. En iPhone, usa Compartir → Guardar en Archivos después de descargar para elegir una ubicación.', '下载位置由浏览器设置决定。iPhone 下载后可通过系统分享中的“存储到文件”选择位置。', '下載位置由瀏覽器設定決定。iPhone 下載後可透過系統分享中的「儲存到檔案」選擇位置。'],
  exportFileType: ['{format} data', 'Datos {format}', '{format} 数据', '{format} 資料'],
  exportDownloadStarted: ['Download started. Choose a location in your browser or system.', 'Descarga iniciada. Elige una ubicación en el navegador o el sistema.', '已发起下载，保存位置由浏览器或系统选择', '已開始下載，儲存位置由瀏覽器或系統選擇'],
  exportSaved: ['Saved to your chosen location.', 'Guardado en la ubicación elegida.', '已保存到你选择的位置', '已儲存到你選擇的位置'],
  exportCancelled: ['Save cancelled.', 'Guardado cancelado.', '已取消保存', '已取消儲存'],
  exportFailed: ['The file was not saved. Check save permissions and try again.', 'No se guardó el archivo. Comprueba los permisos e inténtalo de nuevo.', '没有保存文件。请检查保存权限后重试。', '未儲存檔案。請檢查儲存權限後重試。'],
  reconnect: ['Reconnect', 'Volver a conectar', '重新连接', '重新連線'],
  networkError: ['Cannot connect right now. Check that the service is running.', 'No se puede conectar. Comprueba que el servicio esté en marcha.', '暂时连接不上，请检查服务是否正在运行。', '暫時無法連線，請檢查服務是否正在執行。'],
  calendarDaySummary: ['{date}, {completed} completed, {pending} pending', '{date}, {completed} completadas, {pending} pendientes', '{date}，已完成{completed}项，待办{pending}项', '{date}，已完成{completed}項，待辦{pending}項'],
  calendarDayEmpty: ['{date}, no records', '{date}, sin registros', '{date}，没有记录', '{date}，沒有記錄'],
  completeTaskLabel: ['Complete: {title}', 'Completar: {title}', '完成：{title}', '完成：{title}'],
  undoTaskLabel: ['Mark unfinished: {title}', 'Marcar como pendiente: {title}', '取消完成：{title}', '取消完成：{title}'],
  taskRestored: ['Task marked unfinished.', 'Tarea marcada como pendiente.', '已恢复待办', '已恢復待辦'],
  taskCompleted: ['Task completed.', 'Tarea completada.', '任务已完成。', '任務已完成。'],
  taskDiscardedMeta: ['Stopped · Does not count as completed', 'Abandonada · No cuenta como completada', '不再做 · 不计入完成', '不再做 · 不計入完成'],
  taskMoreLabel: ['More actions: {title}', 'Más acciones: {title}', '更多操作：{title}', '更多操作：{title}'],
  editTask: ['Edit task', 'Editar tarea', '编辑待办', '編輯待辦'],
  emptyPastTitle: ['No records for this day', 'No hay registros de este día', '这一天没有记录', '這一天沒有記錄'],
  emptyCurrentTitle: ['Start with one small thing', 'Empieza con algo pequeño', '从一件小事开始', '從一件小事開始'],
  emptyPastDescription: ['No tasks are assigned to this date.', 'No hay tareas asignadas a esta fecha.', '这一天没有安排任务。', '這一天沒有安排任務。'],
  emptyCurrentDescription: ['Write down something to do and record each step.', 'Apunta algo que quieras hacer y registra cada paso.', '写下一件想做的事，留下每一步。', '寫下一件想做的事，留下每一步。'],
  backToToday: ['Back to today', 'Volver a hoy', '回到今天', '回到今天'],
  daySummary: ['Completed {completed} / {total}', 'Completadas {completed} / {total}', '已完成 {completed} / {total}', '已完成 {completed} / {total}'],
  dayDiscardedSummary: [' · {count} stopped', ' · {count} abandonadas', ' · {count} 项不再做', ' · {count} 項不再做'],
  tasksSummary: ['{pending} pending · {completed} completed today', '{pending} pendientes · {completed} completadas hoy', '{pending} 项待办 · 今天完成 {completed} 项', '{pending} 項待辦 · 今天完成 {completed} 項'],
  editDateHint: ['Changing the date moves this task to that day’s list.', 'Cambiar la fecha mueve esta tarea a la lista de ese día.', '更改日期会把任务移到对应日期的清单。', '更改日期會把任務移到對應日期的清單。'],
  completedDateHint: ['The date is fixed while the task is complete.', 'La fecha se mantiene fija mientras la tarea esté completada.', '已完成任务的日期固定。', '已完成任務的日期固定。'],
  newDateHint: ['This task appears on this date in the calendar.', 'Esta tarea aparece en el calendario en la fecha elegida.', '这项任务会显示在日历的对应日期。', '這項任務會顯示在日曆的對應日期。'],
  taskSaved: ['Changes saved.', 'Cambios guardados.', '修改已保存', '修改已儲存'],
  taskAdded: ['Task added.', 'Tarea añadida.', '已添加待办', '已新增待辦'],
  taskReordered: ['Task order saved.', 'Se guardó el orden de las tareas.', '任务排序已保存。', '任務排序已儲存。'],
  taskDeleted: ['Task and history deleted.', 'Tarea e historial eliminados.', '待办及其历史已删除', '待辦及其歷史已刪除'],
  settings: ['Settings', 'Ajustes', '设置', '設定'],
  closeSettings: ['Close settings', 'Cerrar ajustes', '关闭设置', '關閉設定'],
  appearance: ['Appearance', 'Apariencia', '外观', '外觀'],
  language: ['Language', 'Idioma', '语言', '語言'],
  themeLabel: ['Theme', 'Tema', '主题', '主題'],
  freshThemes: ['Fresh colors', 'Colores suaves', '清新配色', '清新配色'],
  glassTheme: ['Glass', 'Cristal', '玻璃', '玻璃'],
  gradientThemes: ['Gradients', 'Degradados', '渐变', '漸層'],
  account: ['Account', 'Cuenta', '账号', '帳戶'],
  username: ['Username', 'Usuario', '用户名', '使用者名稱'],
  password: ['Password', 'Contraseña', '密码', '密碼'],
  showPassword: ['Show password', 'Mostrar contraseña', '显示密码', '顯示密碼'],
  hidePassword: ['Hide password', 'Ocultar contraseña', '隐藏密码', '隱藏密碼'],
  currentPassword: ['Current password', 'Contraseña actual', '当前密码', '目前密碼'],
  newPassword: ['New password', 'Nueva contraseña', '新密码', '新密碼'],
  newPasswordHint: ['Leave blank to keep your current password.', 'Déjala vacía para conservar la contraseña actual.', '留空则保留当前密码。', '留空則保留目前密碼。'],
  saveAccount: ['Save account', 'Guardar cuenta', '保存账号', '儲存帳戶'],
  accountChangeHint: ['Enter your current password to change account details. Saving signs out every device. Sign in again with your updated credentials.', 'Introduce tu contraseña actual para cambiar los datos de la cuenta. Al guardar se cierra la sesión en todos los dispositivos. Vuelve a entrar con los datos actualizados.', '修改账号信息时，请输入当前密码。保存后所有设备都会退出登录，请使用更新后的账号信息重新登录。', '修改帳戶資料時，請輸入目前密碼。儲存後所有裝置都會登出，請使用更新後的帳戶資料重新登入。'],
  signOut: ['Sign out', 'Cerrar sesión', '退出登录', '登出'],
  signIn: ['Sign in', 'Iniciar sesión', '登录', '登入'],
  signingIn: ['Signing in…', 'Iniciando sesión…', '正在登录…', '正在登入…'],
  loginTitle: ['Sign in · Daily Todo', 'Iniciar sesión · Tareas diarias', '登录 · 日常', '登入 · 日常'],
  loginSubtitle: ['Sign in to your tasks and daily history.', 'Accede a tus tareas y a tu historial diario.', '登录查看待办与每天的记录。', '登入查看待辦與每天的記錄。'],
  defaultCredentialsTitle: ['First time here?', '¿Es tu primera vez?', '首次使用？', '首次使用？'],
  defaultCredentialsHint: ['Use the default account below, then change it in Settings.', 'Usa la cuenta predeterminada y cámbiala después en Ajustes.', '使用下方默认账号登录，然后在设置中修改。', '使用下方預設帳戶登入，然後在設定中修改。'],
  defaultUsername: ['Default username', 'Usuario predeterminado', '默认用户名', '預設使用者名稱'],
  defaultPassword: ['Default password', 'Contraseña predeterminada', '默认密码', '預設密碼'],
  registrationDisabled: ['Registration is disabled. This is a single-account app.', 'El registro está desactivado. Esta aplicación tiene una sola cuenta.', '不开放注册，此应用使用单一账号。', '不開放註冊，此應用程式使用單一帳戶。'],
  accountUpdated: ['Account updated.', 'Cuenta actualizada.', '账号已更新', '帳戶已更新'],
  loginRequired: ['Please sign in to continue.', 'Inicia sesión para continuar.', '请先登录。', '請先登入。'],
  loginFailed: ['Sign-in failed. Check your username and password.', 'No se pudo iniciar sesión. Revisa el usuario y la contraseña.', '登录失败，请检查用户名和密码。', '登入失敗，請檢查使用者名稱和密碼。'],
  saving: ['Saving…', 'Guardando…', '正在保存…', '正在儲存…'],
  themeSelected: ['Theme selected.', 'Tema seleccionado.', '已选择主题', '已選擇主題'],
  preferencesSaved: ['Preferences saved.', 'Preferencias guardadas.', '偏好已保存', '偏好已儲存'],
  loginNetworkError: ['Cannot connect. Check that the service is running and try again.', 'No se puede conectar. Comprueba el servicio e inténtalo de nuevo.', '无法连接，请检查服务是否正在运行后重试。', '無法連線，請檢查服務是否正在執行後重試。'],
  saveFailed: ['Your changes were not saved. Please try again.', 'No se guardaron los cambios. Inténtalo de nuevo.', '操作没有保存，请重试。', '操作未儲存，請重試。'],
  genericError: ['Something went wrong. Please try again.', 'Se ha producido un error. Inténtalo de nuevo.', '发生错误，请重试。', '發生錯誤，請重試。'],
  dataSection: ['Data', 'Datos', '数据', '資料'],
  importData: ['Import data', 'Importar datos', '导入数据', '匯入資料'],
  importDescription: ["Merge tasks and history from this app's exported YML or JSON file. Existing data is kept. Maximum file size: 10 MiB. Choose a file, then press Import data to confirm.", 'Combina tareas e historial de un archivo YML o JSON exportado por esta aplicación. Se conservan los datos actuales. Tamaño máximo: 10 MiB. Elige un archivo y pulsa Importar datos para confirmar.', '仅支持本应用导出的 YML 或 JSON 文件。导入会合并待办与历史，不覆盖现有数据。文件最大 10 MiB。选择文件后，再点击“导入数据”确认。', '僅支援本應用程式匯出的 YML 或 JSON 檔案。匯入會合併待辦與歷史，不覆蓋現有資料。檔案最大 10 MiB。選擇檔案後，再按「匯入資料」確認。'],
  importFileLabel: ['Choose an export file', 'Elegir un archivo exportado', '选择导出文件', '選擇匯出檔案'],
  importNoFile: ['No file selected.', 'Ningún archivo seleccionado.', '尚未选择文件。', '尚未選擇檔案。'],
  importFileSelected: ['Ready to import: {filename}', 'Listo para importar: {filename}', '待导入：{filename}', '待匯入：{filename}'],
  importReading: ['Reading file… Your data has not changed.', 'Leyendo archivo… Los datos no han cambiado.', '正在读取文件…数据未发生更改。', '正在讀取檔案…資料未發生變更。'],
  importing: ['Importing…', 'Importando…', '正在导入…', '正在匯入…'],
  importSuccess: ['Import complete: {imported} tasks imported, {skipped} already present tasks skipped.', 'Importación completada: {imported} tareas importadas y {skipped} ya existentes omitidas.', '导入完成：已导入 {imported} 项待办，跳过 {skipped} 项已存在的待办。', '匯入完成：已匯入 {imported} 項待辦，略過 {skipped} 項已存在的待辦。'],
  importFailed: ['The file could not be imported. Please try again.', 'No se pudo importar el archivo. Inténtalo de nuevo.', '无法导入文件，请重试。', '無法匯入檔案，請重試。'],
  'themes.white': ['White', 'Blanco', '纯白', '純白'],
  'themes.mint': ['Mint', 'Menta', '薄荷', '薄荷'],
  'themes.sky': ['Sky', 'Cielo', '天空', '天空'],
  'themes.lavender': ['Lavender', 'Lavanda', '薰衣草', '薰衣草'],
  'themes.peach': ['Peach', 'Melocotón', '蜜桃', '蜜桃'],
  'themes.glass': ['Glass', 'Cristal', '玻璃', '玻璃'],
  'themes.aurora': ['Aurora', 'Aurora', '极光', '極光'],
  'themes.sunset': ['Sunset', 'Atardecer', '日落', '日落'],
  'themes.ocean': ['Ocean', 'Océano', '海洋', '海洋'],
  'themes.twilight': ['Twilight', 'Crepúsculo', '暮色', '暮色'],
  'errors.AUTH_REQUIRED': ['Please sign in to continue.', 'Inicia sesión para continuar.', '请先登录。', '請先登入。'],
  'errors.INVALID_CREDENTIALS': ['Incorrect username or password.', 'Usuario o contraseña incorrectos.', '用户名或密码不正确。', '使用者名稱或密碼不正確。'],
  'errors.RATE_LIMITED': ['Too many attempts. Please try again later.', 'Demasiados intentos. Inténtalo más tarde.', '尝试次数过多，请稍后重试。', '嘗試次數過多，請稍後重試。'],
  'errors.INVALID_CURRENT_PASSWORD': ['Your current password is incorrect.', 'La contraseña actual es incorrecta.', '当前密码不正确。', '目前密碼不正確。'],
  'errors.INVALID_USERNAME': ['Enter a valid username.', 'Introduce un nombre de usuario válido.', '请输入有效的用户名。', '請輸入有效的使用者名稱。'],
  'errors.INVALID_PASSWORD': ['Enter a valid password.', 'Introduce una contraseña válida.', '请输入有效的密码。', '請輸入有效的密碼。'],
  'errors.CSRF_REJECTED': ['The request was rejected. Reload the page and try again.', 'Se rechazó la solicitud. Recarga la página e inténtalo de nuevo.', '请求未通过验证，请刷新页面后重试。', '請求未通過驗證，請重新整理頁面後重試。'],
  'errors.REGISTRATION_DISABLED': ['Registration is disabled.', 'El registro está desactivado.', '不开放注册。', '不開放註冊。'],
  'errors.INVALID_DATE_FORMAT': ['Use a date in YYYY-MM-DD format.', 'Usa una fecha con formato AAAA-MM-DD.', '请使用 YYYY-MM-DD 日期格式。', '請使用 YYYY-MM-DD 日期格式。'],
  'errors.INVALID_DATE': ['Choose a valid date.', 'Elige una fecha válida.', '请选择有效的日期。', '請選擇有效的日期。'],
  'errors.INVALID_BODY': ['The request is invalid. Reload the page and try again.', 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.', '请求无效，请刷新页面后重试。', '請求無效，請重新整理頁面後重試。'],
  'errors.UNKNOWN_FIELDS': ['The request contains unsupported fields. Reload the page and try again.', 'La solicitud contiene campos no admitidos. Recarga la página e inténtalo de nuevo.', '请求包含不支持的字段，请刷新页面后重试。', '請求包含不支援的欄位，請重新整理頁面後重試。'],
  'errors.INVALID_TITLE': ['Use a task title of 1–300 characters.', 'Usa un título de entre 1 y 300 caracteres.', '待办标题须为 1 至 300 个字符。', '待辦標題須為 1 至 300 個字元。'],
  'errors.INVALID_NOTES': ['Notes must be text of at most 5,000 characters.', 'Las notas deben ser texto de hasta 5000 caracteres.', '补充说明须为文本，且不超过 5000 个字符。', '補充說明須為文字，且不超過 5000 個字元。'],
  'errors.INVALID_BOOLEAN': ['The task status is invalid. Reload the page and try again.', 'El estado de la tarea no es válido. Recarga la página e inténtalo de nuevo.', '待办状态无效，请刷新页面后重试。', '待辦狀態無效，請重新整理頁面後重試。'],
  'errors.MISSING_TITLE': ['Enter a task title.', 'Introduce un título para la tarea.', '请输入待办标题。', '請輸入待辦標題。'],
  'errors.EMPTY_UPDATE': ['No changes were submitted.', 'No se enviaron cambios.', '没有提交任何修改。', '沒有提交任何修改。'],
  'errors.CONFLICTING_STATUS': ['A task cannot be both completed and stopped.', 'Una tarea no puede estar completada y abandonada a la vez.', '待办不能同时标为完成和不再做。', '待辦不能同時標為完成和不再做。'],
  'errors.TASK_DATE_LOCKED': ['Only unfinished tasks can be rescheduled.', 'Solo puedes reprogramar las tareas pendientes.', '只能为未完成的任务改期。', '只能為未完成的任務改期。'],
  'errors.INVALID_TASK_ORDER': ['The task order changed. Reload the page and try again.', 'El orden cambió. Recarga la página e inténtalo de nuevo.', '任务排序有变，请刷新后重试。', '任務排序有變，請重新整理後重試。'],
  'errors.INVALID_MONTH_FORMAT': ['Use a month in YYYY-MM format.', 'Usa un mes con formato AAAA-MM.', '请使用 YYYY-MM 年月格式。', '請使用 YYYY-MM 年月格式。'],
  'errors.INVALID_QUERY': ['The request is invalid. Reload the page and try again.', 'La solicitud no es válida. Recarga la página e inténtalo de nuevo.', '查询参数无效，请刷新页面后重试。', '查詢參數無效，請重新整理頁面後重試。'],
  'errors.INVALID_EXPORT_FORMAT': ['Choose YML or JSON to export.', 'Elige YML o JSON para exportar.', '请选择 YML 或 JSON 格式导出。', '請選擇 YML 或 JSON 格式匯出。'],
  'errors.TASK_CHANGED': ['This task has changed. Reload the page and try again.', 'Esta tarea ha cambiado. Recarga la página e inténtalo de nuevo.', '这条待办已发生变化，请刷新页面后重试。', '這條待辦已發生變更，請重新整理頁面後重試。'],
  'errors.NOT_FOUND': ['This item could not be found. Reload the page and try again.', 'No se encontró este elemento. Recarga la página e inténtalo de nuevo.', '找不到该项目，请刷新页面后重试。', '找不到該項目，請重新整理頁面後重試。'],
  'errors.METHOD_NOT_ALLOWED': ['This action is not supported.', 'Esta acción no está permitida.', '不支持此操作。', '不支援此操作。'],
  'errors.STORAGE_ERROR': ['Data could not be saved. Check storage and try again.', 'No se pudieron guardar los datos. Comprueba el almacenamiento e inténtalo de nuevo.', '无法保存数据，请检查储存空间后重试。', '無法儲存資料，請檢查儲存空間後重試。'],
  'errors.INVALID_PATH': ['This address is invalid.', 'Esta dirección no es válida.', '地址无效。', '網址無效。'],
  'errors.FRONTEND_NOT_BUILT': ['The app files are unavailable. Check the server installation.', 'Los archivos de la aplicación no están disponibles. Revisa la instalación del servidor.', '应用文件不可用，请检查服务端安装。', '應用程式檔案無法使用，請檢查伺服器安裝。'],
  'errors.INVALID_JSON': ['The request could not be read. Reload the page and try again.', 'No se pudo leer la solicitud. Recarga la página e inténtalo de nuevo.', '无法读取请求，请刷新页面后重试。', '無法讀取請求，請重新整理頁面後重試。'],
  'errors.BODY_TOO_LARGE': ['The submitted data is too large.', 'Los datos enviados son demasiado grandes.', '提交的数据过大。', '提交的資料過大。'],
  'errors.UNSUPPORTED_CONTENT_TYPE': ['The request format is unsupported.', 'El formato de la solicitud no es compatible.', '不支持此请求格式。', '不支援此請求格式。'],
  'errors.INVALID_CONTENT_LENGTH': ['The request could not be read. Please try again.', 'No se pudo leer la solicitud. Inténtalo de nuevo.', '无法读取请求，请重试。', '無法讀取請求，請重試。'],
  'errors.UNSUPPORTED_TRANSFER_ENCODING': ['The request format is unsupported.', 'El formato de la solicitud no es compatible.', '不支持此传输格式。', '不支援此傳輸格式。'],
  'errors.INVALID_IMPORT': ["This file cannot be imported. Choose an unmodified export from this app.", 'No se puede importar este archivo. Elige un archivo exportado por esta aplicación sin modificar.', '无法导入此文件，请选择本应用导出的未修改文件。', '無法匯入此檔案，請選擇本應用程式匯出的未修改檔案。'],
  'errors.IMPORT_TOO_LARGE': ['Choose a file no larger than 10 MiB.', 'Elige un archivo de 10 MiB como máximo.', '请选择不超过 10 MiB 的文件。', '請選擇不超過 10 MiB 的檔案。'],
  'errors.IMPORT_FILE_TOO_LARGE': ['Choose a file no larger than 10 MiB.', 'Elige un archivo de 10 MiB como máximo.', '请选择不超过 10 MiB 的文件。', '請選擇不超過 10 MiB 的檔案。'],
  'errors.IMPORT_CONFLICT': ['The file and your current data contain conflicting changes to the same task. Nothing was imported.', 'El archivo y los datos actuales tienen cambios incompatibles en una misma tarea. No se ha importado nada.', '文件与现有数据对同一待办有不同修改，本次未导入任何数据。', '檔案與現有資料對同一待辦有不同修改，本次未匯入任何資料。'],
  'errors.IMPORT_FILE_TYPE': ['Choose a YML, YAML, or JSON file exported by this app.', 'Elige un archivo YML, YAML o JSON exportado por esta aplicación.', '请选择本应用导出的 YML、YAML 或 JSON 文件。', '請選擇本應用程式匯出的 YML、YAML 或 JSON 檔案。'],
  'errors.IMPORT_FILE_READ': ['The file could not be read. Select it again and try again.', 'No se pudo leer el archivo. Vuelve a seleccionarlo e inténtalo de nuevo.', '无法读取文件，请重新选择后重试。', '無法讀取檔案，請重新選擇後重試。'],
  'errors.IMPORT_FILE_ENCODING': ['Choose an export file encoded as UTF-8.', 'Elige un archivo exportado con codificación UTF-8.', '请选择 UTF-8 编码的导出文件。', '請選擇 UTF-8 編碼的匯出檔案。'],
  'errors.IMPORT_NETWORK_ERROR': ['Cannot connect. Your import was not confirmed. Try again when the service is available.', 'No se puede conectar. La importación no está confirmada. Inténtalo cuando el servicio esté disponible.', '无法连接，导入尚未确认，请在服务恢复后重试。', '無法連線，匯入尚未確認，請在服務恢復後重試。'],
  'errors.IMPORT_FAILED': ['The import result could not be confirmed. Reload and check your tasks before trying again.', 'No se pudo confirmar el resultado. Recarga y revisa las tareas antes de volver a intentarlo.', '无法确认导入结果，请刷新并检查待办后再重试。', '無法確認匯入結果，請重新整理並檢查待辦後再重試。'],
};

export const messages = Object.fromEntries(supportedLocales.map((language, index) => [
  language, Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, values[index]])),
]));

function storedLocale() {
  try {
    const value = globalThis.localStorage?.getItem(storageKey);
    return supportedLocales.includes(value) ? value : 'en';
  } catch {
    return 'en';
  }
}

let locale = storedLocale();

export function getLocale() {
  return locale;
}

export function setLocale(value) {
  locale = supportedLocales.includes(value) ? value : 'en';
  try { globalThis.localStorage?.setItem(storageKey, locale); } catch { /* Preferences still work when storage is unavailable. */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
  }
  return locale;
}

export function t(key, params = {}) {
  const text = messages[locale][key] ?? messages.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
}

export function applyTranslations(root = document) {
  const attributes = { 'data-i18n-placeholder': 'placeholder', 'data-i18n-aria-label': 'aria-label', 'data-i18n-title': 'title', 'data-i18n-alt': 'alt' };
  const selector = ['[data-i18n]', ...Object.keys(attributes).map((name) => '[' + name + ']')].join(',');
  const elements = [...root.querySelectorAll(selector)];
  if (root.matches?.(selector)) elements.unshift(root);
  for (const element of elements) {
    if (element.hasAttribute('data-i18n')) element.textContent = t(element.getAttribute('data-i18n'));
    for (const [source, target] of Object.entries(attributes)) {
      if (element.hasAttribute(source)) element.setAttribute(target, t(element.getAttribute(source)));
    }
  }
  const owner = root.ownerDocument || root;
  if (owner.documentElement) owner.documentElement.lang = locale;
}
