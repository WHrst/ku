// 自定义主题包插件
// 直接安装主题到SillyTavern

import { getRequestHeaders } from "../../../../script.js";

const extensionName = 'lu-collection';

// 设置项
let pluginSettings = {
    overwriteCharacters: false, // 是否覆盖已存在的角色卡
    overwriteThemes: true       // 是否覆盖已存在的主题
};

// 主题文件列表
const themeFiles = [
    { name: '', file: '' }
];

// 角色卡文件列表
const characterFiles = [
    { name: '彭杰（new）', file: 'characters/彭杰.png', type: 'png', description: '彭杰' },
    { name: '路高程', file: 'characters/路高程.png', type: 'png', description: '路高程' },
    { name: '林景轩', file: 'characters/林景轩.png', type: 'png', description: '林景轩，清岚' },
    { name: '江易安', file: 'characters/江易安.png', type: 'png', description: '江易安，清岚' },
    { name: '顾蔺', file: 'characters/顾蔺.png', type: 'png', description: '顾蔺，最新版' },
    { name: '周煜', file: 'characters/周煜.png', type: 'png', description: '周煜，内测版' },

];

/**
 * 加载插件设置
 */
function loadPluginSettings() {
    const savedSettings = localStorage.getItem(`${extensionName}_settings`);
    if (savedSettings) {
        try {
            pluginSettings = { ...pluginSettings, ...JSON.parse(savedSettings) };
        } catch (error) {
            console.warn('无法加载插件设置，使用默认设置:', error);
        }
    }
}

/**
 * 保存插件设置
 */
function savePluginSettings() {
    localStorage.setItem(`${extensionName}_settings`, JSON.stringify(pluginSettings));
}

/**
 * 获取SillyTavern上下文
 */
function getSillyTavernContext() {
    // 优先使用window.SillyTavern.getContext()
    if (typeof window.SillyTavern !== 'undefined' && window.SillyTavern.getContext) {
        return window.SillyTavern.getContext();
    }

    // 后备方案：尝试直接访问全局变量
    if (typeof themes !== 'undefined' && Array.isArray(themes)) {
        return {
            themes: themes,
            powerUserSettings: typeof power_user !== 'undefined' ? power_user : null
        };
    }

    return null;
}

/**
 * 从JSON文件加载主题
 */
async function loadThemeFromFile(filePath) {
    try {
        // 先尝试原有路径
        let response = await fetch(`/scripts/extensions/third-party/${extensionName}/${filePath}`);
        if (!response.ok) {
            // 如果原有路径失败，尝试新路径
            response = await fetch(`/../../extensions/${extensionName}/${filePath}`);
            if (!response.ok) {
                console.warn(`无法加载主题文件: ${filePath}`);
                return null;
            }
        }
        const theme = await response.json();
        // 验证主题格式
        if (!theme.name) {
            console.warn(`主题文件缺少name字段: ${filePath}`);
            return null;
        }
        return theme;
    } catch (error) {
        console.error(`加载主题文件失败: ${filePath}`, error);
        return null;
    }
}

/**
 * 检查主题是否已存在
 */
async function checkThemeExists(themeName) {
    try {
        // 获取所有设置，包括主题列表
        const response = await fetch('/api/settings/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({})
        });

        if (response.ok) {
            const settings = await response.json();
            const themes = settings.themes || [];
            return themes.some(theme => theme.name === themeName);
        }
        return false;
    } catch (error) {
        console.error('检查主题是否存在时出错:', error);
        return false;
    }
}

/**
 * 生成唯一的主题名称（如果不覆盖的话）
 */
async function generateUniqueThemeName(baseName) {
    if (pluginSettings.overwriteThemes) {
        return baseName; // 覆盖模式直接返回原名
    }

    let counter = 1;
    let newName = baseName;

    // 检查基础名称是否存在
    if (!(await checkThemeExists(baseName))) {
        return baseName; // 如果基础名称不存在，直接使用
    }

    // 生成带数字后缀的名称
    while (await checkThemeExists(newName)) {
        newName = `${baseName}${counter}`;
        counter++;
    }

    return newName;
}

/**
 * 直接复制主题文件到用户目录
 */
async function copyThemeToUserDirectory(theme) {
    try {
        console.log(`正在复制主题: ${theme.name}`);

        // 如果不覆盖，生成唯一名称
        const finalThemeName = await generateUniqueThemeName(theme.name);

        // 创建主题副本，使用最终的名称
        const themeToSave = {
            ...theme,
            name: finalThemeName
        };

        // 直接调用SillyTavern主服务器的API
        const url = '/api/themes/save';

        // 使用getRequestHeaders获取正确的请求头，包括CSRF token
        const headers = getRequestHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(themeToSave)
        });

        if (response.ok) {
            console.log(`主题 "${finalThemeName}" 复制成功`);
            return { success: true, finalName: finalThemeName, wasRenamed: finalThemeName !== theme.name };
        } else {
            console.error(`复制主题失败: ${theme.name}`, response.status, response.statusText);
            return { success: false, finalName: null, wasRenamed: false };
        }
    } catch (error) {
        console.error(`复制主题时发生错误: ${theme.name}`, error);
        return { success: false, finalName: null, wasRenamed: false };
    }
}

/**
 * 安装所有主题
 */
async function installAllThemes() {
    console.log('开始安装所有主题...');

    let successCount = 0;
    let totalCount = 0;
    let renamedThemes = [];

    for (const themeFile of themeFiles) {
        const theme = await loadThemeFromFile(themeFile.file);
        if (theme) {
            totalCount++;

            const result = await copyThemeToUserDirectory(theme);
            if (result.success) {
                successCount++;
                if (result.wasRenamed) {
                    renamedThemes.push(`"${theme.name}" → "${result.finalName}"`);
                }
            }
        }
    }

    console.log(`主题安装完成: ${successCount}/${totalCount} 个主题成功安装`);

    if (successCount > 0) {
        let message = `成功安装 ${successCount} 个自定义主题！请刷新页面以在主题选择器中看到新主题。`;

        if (renamedThemes.length > 0) {
            message += `\n\n以下主题已重命名避免冲突:\n${renamedThemes.join('\n')}`;
        }

        // 显示成功消息
        if (typeof toastr !== 'undefined') {
            toastr.success(message);
        }

        // 提示用户刷新页面
        console.log('请刷新页面以在主题选择器中看到新安装的主题');
    }
}

/**
 * 下载主题文件（备用方案）
 */
function downloadThemeFile(themeName, fileName) {
    const link = document.createElement('a');
    link.href = `/scripts/extensions/third-party/${extensionName}/${fileName}`;
    link.download = `${themeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 从文件加载角色卡
 */
async function loadCharacterFromFile(filePath, fileType) {
    try {
        // 先尝试原有路径
        let response = await fetch(`/scripts/extensions/third-party/${extensionName}/${filePath}`);
        if (!response.ok) {
            // 如果原有路径失败，尝试新路径
            response = await fetch(`/../../extensions/${extensionName}/${filePath}`);
            if (!response.ok) {
                console.warn(`无法加载角色卡文件: ${filePath}`);
                return null;
            }
        }

        if (fileType === 'png') {
            // 对于PNG文件，返回blob
            return await response.blob();
        } else {
            // 对于JSON/YAML文件，返回JSON
            return await response.json();
        }
    } catch (error) {
        console.error(`加载角色卡文件失败: ${filePath}`, error);
        return null;
    }
}

/**
 * 导入角色卡到SillyTavern
 */
async function importCharacterToSillyTavern(characterData, fileName, fileType) {
    try {
        console.log(`正在导入角色卡: ${fileName}`);

        const formData = new FormData();

        if (fileType === 'png') {
            // PNG文件直接作为blob添加
            formData.append('avatar', characterData, fileName);
        } else {
            // JSON文件需要转换为blob
            const jsonBlob = new Blob([JSON.stringify(characterData)], { type: 'application/json' });
            formData.append('avatar', jsonBlob, fileName);
        }

        formData.append('file_type', fileType);

        // 如果启用覆盖模式，使用preserved_name参数强制使用指定的文件名
        if (pluginSettings.overwriteCharacters) {
            const baseName = fileName.replace(/\.(png|json|yaml|yml|charx)$/i, '');
            formData.append('preserved_name', baseName);
        }

        // 使用getRequestHeaders获取正确的请求头
        const headers = getRequestHeaders();
        // 注意：FormData会自动设置Content-Type，所以要删除headers中的Content-Type
        delete headers['Content-Type'];

        const response = await fetch('/api/characters/import', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            if (result.error) {
                console.error(`导入角色卡失败: ${fileName}`, result.error);
                return false;
            }
            console.log(`角色卡 "${fileName}" 导入成功`);
            return true;
        } else {
            console.error(`导入角色卡失败: ${fileName}`, response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error(`导入角色卡时发生错误: ${fileName}`, error);
        return false;
    }
}

/**
 * 安装所有角色卡
 */
async function installAllCharacters() {
    console.log('开始导入所有角色卡...');

    let successCount = 0;
    let totalCount = 0;

    for (const characterFile of characterFiles) {
        const characterData = await loadCharacterFromFile(characterFile.file, characterFile.type);
        if (characterData) {
            totalCount++;

            const success = await importCharacterToSillyTavern(characterData, characterFile.file.split('/').pop(), characterFile.type);
            if (success) {
                successCount++;
            }
        }
    }

    console.log(`角色卡导入完成: ${successCount}/${totalCount} 个角色卡成功导入`);

    if (successCount > 0) {
        // 显示成功消息
        if (typeof toastr !== 'undefined') {
            toastr.success(`成功导入 ${successCount} 个自定义角色卡！请刷新页面以在角色列表中看到新角色。`);
        }

        // 提示用户刷新页面
        console.log('请刷新页面以在角色列表中看到新导入的角色卡');
    }
}

/**
 * 添加扩展设置界面
 */
function addExtensionUI() {
    // 等待扩展设置容器加载完成
    const checkContainer = setInterval(() => {
        const container = document.getElementById('extensions_settings');
        if (container) {
            clearInterval(checkContainer);

            // 检查是否已经添加过
            if (document.getElementById(`${extensionName}_themes_container`)) {
                return;
            }

            const themeManagerContainer = document.createElement('div');
            themeManagerContainer.id = `${extensionName}_themes_container`;
            themeManagerContainer.className = 'extension_container';

            // 创建主题列表HTML，每行3个
            let themeListHTML = '';
            for (let i = 0; i < themeFiles.length; i += 3) {
                themeListHTML += '<tr class="theme-row">';
                for (let j = 0; j < 3; j++) {
                    const theme = themeFiles[i + j];
                    if (theme) {
                        themeListHTML += `
                            <td>
                                    <span>${theme.name}</span>
                                    <button class="menu_button" id="import_theme_btn_${theme.name}" style="word-break: keep-all;margin-left:0 ;width:auto;display:inline-block">
                                        导入
                                    </button>
                                    <button class="menu_button" id="preview_theme_btn_${theme.name}" style="margin-left:6px;width:auto;display:inline-block">
                                        预览
                                    </button>
                            </td>
                        `;
                    } else {
                        // 补空格
                        themeListHTML += '<td></td>';
                    }
                }
                themeListHTML += '</tr>';
            }

            // 创建角色卡列表HTML，每行3个
            let characterListHTML = '';
            for (let i = 0; i < characterFiles.length; i += 3) {
                characterListHTML += '<tr class="character-row">';
                for (let j = 0; j < 3; j++) {
                    const character = characterFiles[i + j];
                    if (character) {
                        characterListHTML += `
                            <td>
                                    <span>${character.name}</span>
                                    <button class="menu_button" id="import_character_btn_${character.name}" style="word-break: keep-all;margin-left:0 ;width:auto;display:inline-block">
                                        导入
                                    </button>
                                    <button class="menu_button" id="preview_character_btn_${character.name}" style="margin-left:6px;width:auto;display:inline-block">
                                        简介
                                    </button>
                            </td>
                        `;
                    } else {
                        // 补空格
                        characterListHTML += '<td></td>';
                    }
                }
                characterListHTML += '</tr>';
            }

            themeManagerContainer.innerHTML = `
                <div class="${extensionName}_custom_themes_settings">
                    <div class="inline-drawer">
                        <div class="inline-drawer-toggle inline-drawer-header">
                            <b>绝望的lu一下</b>
                            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                        </div>
                        <div class="inline-drawer-content">
                            <div class="extension_settings">
                                <h4>⚙️ 插件设置</h4>
                                <div style="margin: 10px 0;">
                                    <label style="display: flex; align-items: center; gap: 8px;">
                                        <input type="checkbox" id="overwrite_themes_checkbox" ${pluginSettings.overwriteThemes ? 'checked' : ''}>
                                        <span>覆盖已存在的同名主题</span>
                                        <small style="color: #888; margin-left: 8px;">(取消勾选将创建新的副本)</small>
                                    </label>
                                </div>
                                <div style="margin: 10px 0;">
                                    <label style="display: flex; align-items: center; gap: 8px;">
                                        <input type="checkbox" id="overwrite_characters_checkbox" ${pluginSettings.overwriteCharacters ? 'checked' : ''}>
                                        <span>覆盖已存在的同名角色卡</span>
                                        <small style="color: #888; margin-left: 8px;">(取消勾选将创建新的副本)</small>
                                    </label>
                                </div>
                            </div>

                            <div class="extension_settings">
                                <h4>🎨 主题管理</h4>
                                <button id="install_all_themes" class="menu_button" style="word-break: keep-all;width:auto">
                                    <i class="fa-solid fa-palette"></i>
                                    一键安装所有主题
                                </button>
                                <button id="download_all_themes" class="menu_button" style="word-break: keep-al;width:auto">
                                    <i class="fa-solid fa-download"></i>
                                    下载所有主题
                                </button>
                                <button id="show_install_guide" class="menu_button" style="word-break: keep-all;width:auto">
                                    <i class="fa-solid fa-question-circle"></i>
                                    安装指南
                                </button>
                            </div>
                            <table class="theme_list" style="display:table;flex-wrap:wrap;gap:10px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:12px 0;width:100%;">
                                ${themeListHTML}
                            </table>

                            <div class="extension_settings" style="margin-top: 20px;">
                                <h4>👤 角色卡管理</h4>
                                <button id="install_all_characters" class="menu_button" style="word-break: keep-all;width:auto">
                                    <i class="fa-solid fa-users"></i>
                                    一键导入所有角色卡
                                </button>
                                <button id="download_all_characters" class="menu_button" style="word-break: keep-al;width:auto">
                                    <i class="fa-solid fa-download"></i>
                                    下载所有角色卡
                                </button>
                                <button id="show_character_guide" class="menu_button" style="word-break: keep-all;width:auto">
                                    <i class="fa-solid fa-question-circle"></i>
                                    角色卡说明
                                </button>
                            </div>
                            <table class="character_list" style="display:table;flex-wrap:wrap;gap:10px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:12px 0;width:100%;">
                                ${characterListHTML}
                            </table>
                            <style>

                            </style>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(themeManagerContainer);

            // 绑定设置事件
            $('#overwrite_themes_checkbox').on('change', function() {
                pluginSettings.overwriteThemes = this.checked;
                savePluginSettings();
                if (typeof toastr !== 'undefined') {
                    if (this.checked) {
                        toastr.info('现在导入主题时会覆盖同名主题');
                    } else {
                        toastr.info('现在导入主题时会创建新的副本');
                    }
                }
            });

            $('#overwrite_characters_checkbox').on('change', function() {
                pluginSettings.overwriteCharacters = this.checked;
                savePluginSettings();
                if (typeof toastr !== 'undefined') {
                    if (this.checked) {
                        toastr.info('现在导入角色卡时会覆盖同名角色卡');
                    } else {
                        toastr.info('现在导入角色卡时会创建新的副本');
                    }
                }
            });

            // 绑定主题相关事件
            $('#install_all_themes').on('click', installAllThemes);
            $('#download_all_themes').on('click', () => {
                themeFiles.forEach((theme, index) => {
                    setTimeout(() => {
                        downloadThemeFile(theme.name, theme.file);
                    }, index * 500);
                });
                if (typeof toastr !== 'undefined') {
                    toastr.success('所有主题文件已开始下载！');
                }
            });
            $('#show_install_guide').on('click', () => {
                const overwriteStatus = pluginSettings.overwriteThemes ? '会覆盖同名主题' : '会创建新的副本';
                if (typeof toastr !== 'undefined') {
                    toastr.info(`
                        <strong>安装指南：</strong><br>
                        1. 推荐使用\"一键安装所有主题\"<br>
                        2. 如果失败，下载主题文件手动安装<br>
                        3. 将JSON文件放到主题目录<br>
                        4. 刷新页面<br>
                        5. 在设置中选择新主题<br>
                        <br><strong>当前设置：</strong>${overwriteStatus}
                    `, '安装指南', { timeOut: 0, extendedTimeOut: 0 });
                }
            });

            // 绑定角色卡相关事件
            $('#install_all_characters').on('click', installAllCharacters);
            $('#download_all_characters').on('click', () => {
                characterFiles.forEach((character, index) => {
                    setTimeout(() => {
                        downloadCharacterFile(character.name, character.file);
                    }, index * 500);
                });
                if (typeof toastr !== 'undefined') {
                    toastr.success('所有角色卡文件已开始下载！');
                }
            });
            $('#show_character_guide').on('click', () => {
                const overwriteStatus = pluginSettings.overwriteCharacters ? '会覆盖同名角色卡' : '会创建新的副本';
                if (typeof toastr !== 'undefined') {
                    toastr.info(`
                        <strong>角色卡说明：</strong><br>
                        1. 推荐使用\"一键导入所有角色卡\"<br>
                        2. 支持PNG和JSON格式的角色卡<br>
                        3. 导入后会自动添加到角色列表<br>
                        4. 刷新页面后即可在角色选择器中看到<br>
                        5. 可以单独导入感兴趣的角色卡<br>
                        6. 点击"简介"按钮可以查看角色详细介绍<br>
                        <br><strong>当前设置：</strong>${overwriteStatus}
                    `, '角色卡说明', { timeOut: 0, extendedTimeOut: 0 });
                }
            });

            // 为每个主题导入按钮绑定事件
            themeFiles.forEach(theme => {
                // 导入按钮
                const btn = document.getElementById(`import_theme_btn_${theme.name}`);
                if (btn) {
                    btn.addEventListener('click', async () => {
                        const themeObj = await loadThemeFromFile(theme.file);
                        if (!themeObj) {
                            if (typeof toastr !== 'undefined') toastr.error(`无法读取主题文件: ${theme.file}`);
                            return;
                        }
                        const result = await copyThemeToUserDirectory(themeObj);
                        if (typeof toastr !== 'undefined') {
                            if (result.success) {
                                const actionText = '导入';
                                const coverText = result.wasRenamed ? `(已重命名为"${result.finalName}")` : pluginSettings.overwriteThemes ? '(已覆盖同名主题)' : '';
                                toastr.success(`主题"${themeObj.name}"${actionText}成功！${coverText}请刷新页面以在主题选择器中看到新主题`);
                            } else {
                                toastr.error(`主题"${themeObj.name}"导入失败`);
                            }
                        }
                    });
                }
                // 预览按钮
                const previewBtn = document.getElementById(`preview_theme_btn_${theme.name}`);
                if (previewBtn) {
                    previewBtn.addEventListener('click', () => {
                        // 创建或获取modal
                        let modal = document.getElementById('theme_preview_modal');
                        if (!modal) {
                            modal = document.createElement('div');
                            modal.id = 'theme_preview_modal';
                            modal.style.position = 'fixed';
                            modal.style.top = '0';
                            modal.style.left = '0';
                            modal.style.width = '100vw';
                            modal.style.height = '100vh';
                            modal.style.background = 'rgba(0,0,0,0.5)';
                            modal.style.display = 'flex';
                            modal.style.alignItems = 'center';
                            modal.style.justifyContent = 'center';
                            modal.style.zIndex = '9999';
                            modal.innerHTML = `<div id="theme_preview_content" style="background:rgba(0,0,0,0.2);padding:16px;border-radius:8px;max-width:90vw;max-height:90vh;box-shadow:0 2px 16px #0008;display:flex;flex-direction:column;align-items:center;">
                                <img id="theme_preview_img" src="" alt="预览" style="max-width:80vw;max-height:70vh;object-fit:contain;" />
                                <button id="close_theme_preview" style="margin-top:-41px;">关闭</button>
                            </div>`;
                            const container = document.querySelector(`.${extensionName}_custom_themes_settings`);
                            if (container) {
                                container.appendChild(modal);
                            } else {
                                console.error('找不到主题预览容器', `.${extensionName}_custom_themes_settings`);
                            }
                            document.getElementById('close_theme_preview').onclick = () => {
                                modal.style.display = 'none';
                            };
                        } else {
                            modal.style.display = 'flex';
                        }
                        // 设置图片路径
                        const img = document.getElementById('theme_preview_img');
                        if (img) {
                            img.src = `../../scripts/extensions/third-party/${extensionName}/images/${theme.name}.jpg`;
                        }
                    });
                }
            });

            // 为每个角色卡导入按钮绑定事件
            characterFiles.forEach(character => {
                // 导入按钮
                const btn = document.getElementById(`import_character_btn_${character.name}`);
                if (btn) {
                    btn.addEventListener('click', async () => {
                        const characterData = await loadCharacterFromFile(character.file, character.type);
                        if (!characterData) {
                            if (typeof toastr !== 'undefined') toastr.error(`无法读取角色卡文件: ${character.file}`);
                            return;
                        }
                        const success = await importCharacterToSillyTavern(characterData, character.file.split('/').pop(), character.type);
                        if (typeof toastr !== 'undefined') {
                            const actionText = pluginSettings.overwriteCharacters ? '导入' : '导入';
                            const coverText = pluginSettings.overwriteCharacters ? '(已覆盖同名角色卡)' : '(已创建新副本)';
                            if (success) toastr.success(`角色卡"${character.name}"${actionText}成功！${coverText}请刷新页面以在角色列表中看到新角色`);
                            else toastr.error(`角色卡"${character.name}"${actionText}失败`);
                        }
                    });
                }
                // 简介按钮（原预览按钮）
                const previewBtn = document.getElementById(`preview_character_btn_${character.name}`);
                if (previewBtn) {
                    previewBtn.addEventListener('click', () => {
                        // 创建或获取角色卡简介modal
                        let modal = document.getElementById('character_description_modal');
                        if (!modal) {
                            modal = document.createElement('div');
                            modal.id = 'character_description_modal';
                            modal.style.position = 'fixed';
                            modal.style.top = '0';
                            modal.style.left = '0';
                            modal.style.width = '100vw';
                            modal.style.height = '100vh';
                            modal.style.background = 'rgba(0,0,0,0.5)';
                            modal.style.display = 'flex';
                            modal.style.alignItems = 'center';
                            modal.style.justifyContent = 'center';
                            modal.style.zIndex = '9999';
                            modal.innerHTML = `
                                <div id="character_description_content" style="background:var(--SmartThemeBackgroundColor, #222);padding:24px;border-radius:12px;max-width:600px;max-height:80vh;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;flex-direction:column;color:var(--SmartThemeBodyColor, #fff);overflow-y:auto;">
                                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px;">
                                        <h3 id="character_description_title" style="margin:0;color:var(--SmartThemeBodyColor, #fff);font-size:1.2em;"></h3>
                                        <button id="close_character_description" style="background:none;border:none;color:var(--SmartThemeBodyColor, #fff);font-size:1.5em;cursor:pointer;padding:4px;">×</button>
                                    </div>
                                    <div id="character_description_text" style="line-height:1.6;color:var(--SmartThemeBodyColor, #ccc);white-space:pre-wrap;"></div>
                                    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
                                        <button id="import_from_description" class="menu_button" style="word-break:keep-all;width:auto;">
                                            <i class="fa-solid fa-download"></i>
                                            导入此角色卡
                                        </button>
                                    </div>
                                </div>
                            `;
                            const container = document.querySelector(`.${extensionName}_custom_themes_settings`);
                            if (container) {
                                container.appendChild(modal);
                            } else {
                                console.error('找不到角色卡简介容器', `.${extensionName}_custom_themes_settings`);
                            }
                            document.getElementById('close_character_description').onclick = () => {
                                modal.style.display = 'none';
                            };
                            // 点击背景关闭模态框
                            modal.onclick = (e) => {
                                if (e.target === modal) {
                                    modal.style.display = 'none';
                                }
                            };
                        } else {
                            modal.style.display = 'flex';
                        }

                        // 设置角色信息
                        const titleElement = document.getElementById('character_description_title');
                        const textElement = document.getElementById('character_description_text');
                        const importBtn = document.getElementById('import_from_description');

                        if (titleElement) titleElement.textContent = character.name;
                        if (textElement) textElement.textContent = character.description || '暂无简介';

                        // 绑定导入按钮事件
                        if (importBtn) {
                            importBtn.onclick = async () => {
                                const characterData = await loadCharacterFromFile(character.file, character.type);
                                if (!characterData) {
                                    if (typeof toastr !== 'undefined') toastr.error(`无法读取角色卡文件: ${character.file}`);
                                    return;
                                }
                                const success = await importCharacterToSillyTavern(characterData, character.file.split('/').pop(), character.type);
                                if (typeof toastr !== 'undefined') {
                                    const actionText = pluginSettings.overwriteCharacters ? '导入' : '导入';
                                    const coverText = pluginSettings.overwriteCharacters ? '(已覆盖同名角色卡)' : '(已创建新副本)';
                                    if (success) {
                                        toastr.success(`角色卡"${character.name}"${actionText}成功！${coverText}请刷新页面以在角色列表中看到新角色`);
                                        modal.style.display = 'none'; // 成功后关闭模态框
                                    } else {
                                        toastr.error(`角色卡"${character.name}"${actionText}失败`);
                                    }
                                }
                            };
                        }
                    });
                }
            });
        }
    }, 1000);
}

/**
 * 下载角色卡文件（备用方案）
 */
function downloadCharacterFile(characterName, fileName) {
    const link = document.createElement('a');
    link.href = `/scripts/extensions/third-party/${extensionName}/${fileName}`;
    link.download = `${characterName}.${fileName.split('.').pop()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 插件初始化
 */
function onExtensionLoad() {
    console.log('自定义主题包插件已加载');

    // 加载设置
    loadPluginSettings();

    // 添加设置界面
    addExtensionUI();
}

// 插件加载时执行
onExtensionLoad();
