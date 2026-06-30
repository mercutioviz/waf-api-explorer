// API Base URL - use relative path to work with any host
const API_BASE = window.location.origin;

// State management
let isLoggedIn = false;
let currentConfig = null;
let apiSpec = null;
let selectedEndpoint = null;
let requestHistory = [];
let savedConfigs = [];
let allEndpoints = []; // For search/filter
let isDarkMode = false;

// DOM Elements
const loginSection = document.getElementById('login-section');
const apiSection = document.getElementById('api-section');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginMessage = document.getElementById('login-message');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const configDetails = document.getElementById('config-details');
const endpointsContainer = document.getElementById('endpoints-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if already configured
  checkConfiguration();
  
  // Setup event listeners
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Load and display saved configs on login screen
  loadLoginScreenConfigs();
});

// Check current configuration status
async function checkConfiguration() {
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    const config = await response.json();
    
    if (config.is_configured) {
      currentConfig = config;
      showApiSection();
      updateConnectionStatus(true);
      displayConfiguration(config);
      loadApiSpec();
    }
  } catch (error) {
    console.error('Error checking configuration:', error);
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  const formData = new FormData(loginForm);
  const loginData = {
    host: formData.get('host'),
    port: parseInt(formData.get('port')),
    protocol: formData.get('protocol'),
    username: formData.get('username'),
    password: formData.get('password')
  };
  
  // Show loading state
  setLoginLoading(true);
  hideMessage();
  
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Login successful
      showMessage('✅ Login successful! Token retrieved.', 'success');
      currentConfig = result.config;
      // Store the actual token from the login response
      currentConfig.waf_api_token = result.token;
      
      // Wait a moment then switch to API section
      setTimeout(() => {
        showApiSection();
        updateConnectionStatus(true);
        displayConfiguration(currentConfig);
        loadApiSpec();
      }, 1000);
      
    } else {
      // Login failed
      const errorMsg = result.message || result.error || 'Login failed';
      showMessage(`❌ ${errorMsg}`, 'error');
      updateConnectionStatus(false);
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showMessage(`❌ Connection error: ${error.message}`, 'error');
    updateConnectionStatus(false);
  } finally {
    setLoginLoading(false);
  }
}

// Handle logout
function handleLogout() {
  isLoggedIn = false;
  currentConfig = null;
  
  // Clear form
  loginForm.reset();
  
  // Switch back to login section
  showLoginSection();
  updateConnectionStatus(false);
  hideMessage();
}

// Show/hide sections
function showLoginSection() {
  loginSection.style.display = 'block';
  apiSection.style.display = 'none';
}

function showApiSection() {
  loginSection.style.display = 'none';
  apiSection.style.display = 'block';
  isLoggedIn = true;
}

// Update connection status indicator
function updateConnectionStatus(connected) {
  if (connected) {
    statusIndicator.className = 'status-indicator connected';
    statusText.textContent = `Connected to ${currentConfig?.waf_host || 'WAF'}`;
  } else {
    statusIndicator.className = 'status-indicator disconnected';
    statusText.textContent = 'Not Connected';
  }
}

// Display configuration details
function displayConfiguration(config) {
  configDetails.innerHTML = `
    <div class="config-item">
      <strong>Host:</strong> ${config.waf_host}
    </div>
    <div class="config-item">
      <strong>Port:</strong> ${config.waf_port}
    </div>
    <div class="config-item">
      <strong>Protocol:</strong> ${config.waf_protocol}
    </div>
    <div class="config-item">
      <strong>API Version:</strong> ${config.api_version}
    </div>
    <div class="config-item">
      <strong>Base URL:</strong> ${config.base_url}
    </div>
    <div class="config-item">
      <strong>Token:</strong> 
      <span id="token-display">••••••••••••••••</span>
      <button id="copy-token-btn" class="btn-icon-small" title="Copy token to clipboard" style="margin-left: 10px;">📋</button>
      <button id="toggle-token-btn" class="btn-icon-small" title="Show/hide token" style="margin-left: 5px;">👁️</button>
    </div>
  `;
  
  // Setup copy token button
  const copyTokenBtn = document.getElementById('copy-token-btn');
  const toggleTokenBtn = document.getElementById('toggle-token-btn');
  const tokenDisplay = document.getElementById('token-display');
  let tokenVisible = false;
  
  copyTokenBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(config.waf_api_token);
      const originalText = copyTokenBtn.textContent;
      copyTokenBtn.textContent = '✅';
      setTimeout(() => {
        copyTokenBtn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = config.waf_api_token;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        const originalText = copyTokenBtn.textContent;
        copyTokenBtn.textContent = '✅';
        setTimeout(() => {
          copyTokenBtn.textContent = originalText;
        }, 2000);
      } catch (err2) {
        console.error('Fallback copy failed:', err2);
        copyTokenBtn.textContent = '❌';
        setTimeout(() => {
          copyTokenBtn.textContent = '📋';
        }, 2000);
      }
      document.body.removeChild(textArea);
    }
  });
  
  // Setup toggle token visibility button
  toggleTokenBtn.addEventListener('click', () => {
    tokenVisible = !tokenVisible;
    if (tokenVisible) {
      tokenDisplay.textContent = config.waf_api_token;
      toggleTokenBtn.textContent = '🙈';
      toggleTokenBtn.title = 'Hide token';
    } else {
      tokenDisplay.textContent = '••••••••••••••••';
      toggleTokenBtn.textContent = '👁️';
      toggleTokenBtn.title = 'Show token';
    }
  });
}

// Load API specification
async function loadApiSpec() {
  try {
    const response = await fetch(`${API_BASE}/spec`);
    const specArray = await response.json();
    
    // Store the spec for later use
    apiSpec = specArray;
    
    displayApiEndpoints(specArray);
    
  } catch (error) {
    console.error('Error loading API spec:', error);
    endpointsContainer.innerHTML = '<p class="error">Failed to load API specification.</p>';
  }
}

// Display API endpoints from spec
function displayApiEndpoints(specArray) {
  endpointsContainer.innerHTML = '';
  
  specArray.forEach((api, apiIndex) => {
    const title = api.info?.title || `API ${apiIndex + 1}`;
    const description = api.info?.description || '';
    const paths = Object.keys(api.paths || {});
    
    const apiBlock = document.createElement('div');
    apiBlock.className = 'api-block';
    
    const heading = document.createElement('h4');
    heading.textContent = title;
    apiBlock.appendChild(heading);
    
    if (description) {
      const desc = document.createElement('p');
      desc.className = 'api-description';
      desc.textContent = description;
      apiBlock.appendChild(desc);
    }
    
    const endpointCount = document.createElement('p');
    endpointCount.className = 'endpoint-count';
    endpointCount.textContent = `${paths.length} endpoint${paths.length !== 1 ? 's' : ''}`;
    apiBlock.appendChild(endpointCount);
    
    const ul = document.createElement('ul');
    ul.className = 'endpoint-list';
    
    paths.forEach(path => {
      const methods = Object.keys(api.paths[path]);
      const li = document.createElement('li');
      li.className = 'endpoint-item';
      
      const methodBadges = methods.map(method => 
        `<span class="method-badge method-${method.toLowerCase()}">${method.toUpperCase()}</span>`
      ).join(' ');
      
      li.innerHTML = `${methodBadges} <code>${path}</code>`;
      
      // Make endpoint clickable
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        openRequestBuilder(api, path, methods[0], apiIndex);
      });
      
      ul.appendChild(li);
    });
    
    apiBlock.appendChild(ul);
    endpointsContainer.appendChild(apiBlock);
  });
  
  // Setup request builder close button
  const closeBuilderBtn = document.getElementById('close-builder');
  if (closeBuilderBtn) {
    closeBuilderBtn.addEventListener('click', closeRequestBuilder);
  }
}

// Open request builder for selected endpoint
function openRequestBuilder(api, path, method, apiIndex) {
  const requestBuilder = document.getElementById('request-builder');
  const selectedEndpointEl = document.getElementById('selected-endpoint');
  const selectedMethodEl = document.getElementById('selected-method');
  const endpointDescriptionEl = document.getElementById('endpoint-description');
  const paramsContainer = document.getElementById('request-params-container');
  
  // Store selected endpoint info
  selectedEndpoint = {
    api: api,
    path: path,
    method: method,
    apiIndex: apiIndex,
    spec: api.paths[path][method]
  };
  
  // Update endpoint info
  selectedEndpointEl.textContent = path;
  selectedMethodEl.textContent = method.toUpperCase();
  selectedMethodEl.className = `method-badge method-${method.toLowerCase()}`;
  
  const description = selectedEndpoint.spec.summary || selectedEndpoint.spec.description || 'No description available';
  endpointDescriptionEl.textContent = description;
  
  // Build parameter form
  buildParameterForm(selectedEndpoint.spec, paramsContainer);
  
  // Show request builder
  requestBuilder.style.display = 'block';
  requestBuilder.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  // Setup send request button
  const sendBtn = document.getElementById('send-request-btn');
  sendBtn.onclick = sendApiRequest;
}

// Build parameter form based on API spec
function buildParameterForm(spec, container) {
  container.innerHTML = '';
  
  const parameters = spec.parameters || [];
  const requestBody = spec.requestBody;
  
  // Check if there are any parameters or request body
  if (parameters.length === 0 && !requestBody) {
    container.innerHTML = '<p class="info-text">No parameters required for this endpoint.</p>';
    return;
  }
  
  // Add path and query parameters
  if (parameters.length > 0) {
    parameters.forEach(param => {
      const paramDiv = document.createElement('div');
      paramDiv.className = 'param-group';
      
      const label = document.createElement('label');
      label.textContent = `${param.name}${param.required ? ' *' : ''}`;
      label.className = 'param-label';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.name = param.name;
      input.className = 'param-input';
      input.placeholder = param.description || `Enter ${param.name}`;
      input.dataset.paramType = param.in; // 'path', 'query', etc.
      
      if (param.required) {
        input.required = true;
      }
      
      const description = document.createElement('small');
      description.className = 'param-description';
      description.textContent = `${param.in} parameter${param.description ? ': ' + param.description : ''}`;
      
      paramDiv.appendChild(label);
      paramDiv.appendChild(input);
      paramDiv.appendChild(description);
      container.appendChild(paramDiv);
    });
  }
  
  // Add request body editor for POST/PUT/PATCH
  if (requestBody) {
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'param-group';
    
    const label = document.createElement('label');
    label.textContent = 'Request Body *';
    label.className = 'param-label';
    
    const textarea = document.createElement('textarea');
    textarea.id = 'request-body-editor';
    textarea.className = 'body-editor';
    textarea.placeholder = 'Enter JSON request body...';
    textarea.rows = 10;
    
    // Try to provide a sample body if schema is available
    const schema = requestBody.content?.['application/json']?.schema;
    if (schema && schema.example) {
      textarea.value = JSON.stringify(schema.example, null, 2);
    } else {
      textarea.value = '{\n  \n}';
    }
    
    const description = document.createElement('small');
    description.className = 'param-description';
    description.textContent = 'JSON request body';
    
    bodyDiv.appendChild(label);
    bodyDiv.appendChild(textarea);
    bodyDiv.appendChild(description);
    container.appendChild(bodyDiv);
  }
}

// Close request builder
function closeRequestBuilder() {
  const requestBuilder = document.getElementById('request-builder');
  const responseSection = document.getElementById('response-section');
  
  requestBuilder.style.display = 'none';
  responseSection.style.display = 'none';
  selectedEndpoint = null;
}

// Send API request
async function sendApiRequest() {
  if (!selectedEndpoint) return;
  
  const sendBtn = document.getElementById('send-request-btn');
  const btnText = sendBtn.querySelector('.btn-text');
  const btnSpinner = sendBtn.querySelector('.btn-spinner');
  const responseSection = document.getElementById('response-section');
  const responseStatusCode = document.getElementById('response-status-code');
  const responseContent = document.getElementById('response-content');
  const requestDetailsSection = document.getElementById('request-details-section');
  
  // Show loading state
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline';
  sendBtn.disabled = true;
  
  try {
    // Collect parameters from form
    const paramInputs = document.querySelectorAll('.param-input');
    const pathParams = {};
    const queryParams = {};
    
    paramInputs.forEach(input => {
      const value = input.value.trim();
      if (value) {
        if (input.dataset.paramType === 'path') {
          pathParams[input.name] = value;
        } else if (input.dataset.paramType === 'query') {
          queryParams[input.name] = value;
        }
      }
    });
    
    // Build the endpoint path with path parameters
    let endpoint = selectedEndpoint.path;
    Object.keys(pathParams).forEach(key => {
      endpoint = endpoint.replace(`{${key}}`, pathParams[key]);
    });
    
    // Remove leading slash
    endpoint = endpoint.replace(/^\//, '');
    
    // Build the actual WAF URL (not the proxy URL)
    const wafBaseUrl = `${currentConfig.waf_protocol}://${currentConfig.waf_host}:${currentConfig.waf_port}`;
    let wafUrl = `${wafBaseUrl}/restapi/${currentConfig.api_version}/${endpoint}`;
    if (Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams(queryParams).toString();
      wafUrl += `?${queryString}`;
    }
    
    // Get request body
    let requestBody = null;
    const bodyEditor = document.getElementById('request-body-editor');
    if (bodyEditor && bodyEditor.value.trim()) {
      try {
        requestBody = JSON.parse(bodyEditor.value);
      } catch (e) {
        throw new Error('Invalid JSON in request body: ' + e.message);
      }
    }
    
    // Generate command syntax
    generateCommandSyntax(
      selectedEndpoint.method.toUpperCase(),
      wafUrl,
      currentConfig.waf_api_token,
      requestBody
    );
    
    // Show request details
    requestDetailsSection.style.display = 'block';
    
    // Build proxy URL for actual request
    let proxyUrl = `${API_BASE}/api/waf/${endpoint}`;
    if (Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams(queryParams).toString();
      proxyUrl += `?${queryString}`;
    }
    
    // Prepare request options
    const requestOptions = {
      method: selectedEndpoint.method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Add request body
    if (requestBody) {
      requestOptions.body = JSON.stringify(requestBody);
    }
    
    // Make the request
    const response = await fetch(proxyUrl, requestOptions);
    
    // Get response data
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { text: await response.text() };
    }
    
    // Display response
    responseStatusCode.textContent = response.status;
    responseStatusCode.className = response.ok ? 'status-success' : 'status-error';
    responseContent.textContent = JSON.stringify(data, null, 2);
    responseSection.style.display = 'block';
    
    // Scroll to response
    responseSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
  } catch (error) {
    console.error('Request error:', error);
    responseStatusCode.textContent = 'Error';
    responseStatusCode.className = 'status-error';
    responseContent.textContent = `Error: ${error.message}`;
    responseSection.style.display = 'block';
  } finally {
    // Reset button state
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
    sendBtn.disabled = false;
  }
}

// Generate command syntax for curl, PowerShell, and Python
function generateCommandSyntax(method, url, token, body) {
  const curlCmd = document.getElementById('curl-command');
  const powershellCmd = document.getElementById('powershell-command');
  const pythonCmd = document.getElementById('python-command');
  
  // Generate cURL command (Barracuda WAF uses Basic Auth with token:)
  let curl = `curl -X ${method} "${url}" \\\n`;
  curl += `  -u '${token}:' \\\n`;
  curl += `  -H "Content-Type: application/json"`;
  if (body) {
    curl += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
  }
  curlCmd.textContent = curl;
  
  // Generate PowerShell command (using Basic Auth)
  let ps = `# Create credentials for Basic Auth\n`;
  ps += `$token = "${token}"\n`;
  ps += `$pair = "$token:"\n`;
  ps += `$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)\n`;
  ps += `$base64 = [System.Convert]::ToBase64String($bytes)\n\n`;
  ps += `$headers = @{\n`;
  ps += `    "Content-Type" = "application/json"\n`;
  ps += `    "Authorization" = "Basic $base64"\n`;
  ps += `}\n\n`;
  if (body) {
    ps += `$body = @'\n${JSON.stringify(body, null, 2)}\n'@\n\n`;
    ps += `Invoke-RestMethod -Uri "${url}" \`\n`;
    ps += `    -Method ${method} \`\n`;
    ps += `    -Headers $headers \`\n`;
    ps += `    -Body $body`;
  } else {
    ps += `Invoke-RestMethod -Uri "${url}" \`\n`;
    ps += `    -Method ${method} \`\n`;
    ps += `    -Headers $headers`;
  }
  powershellCmd.textContent = ps;
  
  // Generate Python command (using Basic Auth)
  let python = `import requests\nfrom requests.auth import HTTPBasicAuth\nimport json\n\n`;
  python += `url = "${url}"\n`;
  python += `# Barracuda WAF uses token as username, empty string as password\n`;
  python += `auth = HTTPBasicAuth("${token}", "")\n`;
  python += `headers = {\n`;
  python += `    "Content-Type": "application/json"\n`;
  python += `}\n`;
  if (body) {
    python += `\ndata = ${JSON.stringify(body, null, 2)}\n\n`;
    python += `response = requests.${method.toLowerCase()}(url, auth=auth, headers=headers, json=data)\n`;
  } else {
    python += `\nresponse = requests.${method.toLowerCase()}(url, auth=auth, headers=headers)\n`;
  }
  python += `print(response.json())`;
  pythonCmd.textContent = python;
  
  // Setup tab switching
  setupCommandTabs();
}

// Setup command tabs
function setupCommandTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const copyBtn = document.getElementById('copy-command-btn');
  
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      // Remove active class from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked
      btn.classList.add('active');
      const tabId = btn.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    };
  });
  
  // Copy button
  copyBtn.onclick = async () => {
    const activeTab = document.querySelector('.tab-content.active pre');
    if (activeTab) {
      try {
        await navigator.clipboard.writeText(activeTab.textContent);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = activeTab.textContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        } catch (err2) {
          console.error('Fallback copy failed:', err2);
          copyBtn.textContent = '❌ Copy failed';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
          }, 2000);
        }
        document.body.removeChild(textArea);
      }
    }
  };
}

// UI Helper functions
function setLoginLoading(loading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnSpinner = loginBtn.querySelector('.btn-spinner');
  
  if (loading) {
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline';
    loginBtn.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
    loginBtn.disabled = false;
  }
}

function showMessage(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = `message ${type}`;
  loginMessage.style.display = 'block';
}

function hideMessage() {
  loginMessage.style.display = 'none';
}

// ============================================
// ENHANCED FEATURES
// ============================================

// Dark Mode Toggle
function initDarkMode() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  
  // Load saved preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    isDarkMode = true;
    themeIcon.textContent = '☀️';
  }
  
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    isDarkMode = !isDarkMode;
    themeIcon.textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  });
}

// Search/Filter Endpoints
function initSearch() {
  const searchInput = document.getElementById('endpoint-search');
  const clearSearchBtn = document.getElementById('clear-search');
  const endpointCountBadge = document.getElementById('endpoint-count');
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    filterEndpoints(query);
    clearSearchBtn.style.display = query ? 'block' : 'none';
  });
  
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterEndpoints('');
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
  });
  
  function filterEndpoints(query) {
    const apiBlocks = document.querySelectorAll('.api-block');
    let totalVisible = 0;
    
    apiBlocks.forEach(block => {
      const endpoints = block.querySelectorAll('.endpoint-item');
      let visibleInBlock = 0;
      
      endpoints.forEach(endpoint => {
        const text = endpoint.textContent.toLowerCase();
        const matches = !query || text.includes(query);
        endpoint.style.display = matches ? 'flex' : 'none';
        if (matches) visibleInBlock++;
      });
      
      // Hide entire block if no endpoints match
      block.style.display = visibleInBlock > 0 ? 'block' : 'none';
      totalVisible += visibleInBlock;
    });
    
    // Update count badge
    if (query) {
      endpointCountBadge.textContent = `${totalVisible} found`;
      endpointCountBadge.style.display = 'inline-block';
    } else {
      endpointCountBadge.style.display = 'none';
    }
  }
}

// Request History Management
function initHistory() {
  const showHistoryBtn = document.getElementById('show-history-btn');
  const historyPanel = document.getElementById('history-panel');
  const closeHistoryBtn = document.getElementById('close-history');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyList = document.getElementById('history-list');
  
  // Load history from localStorage
  const savedHistory = localStorage.getItem('requestHistory');
  if (savedHistory) {
    requestHistory = JSON.parse(savedHistory);
  }
  
  showHistoryBtn.addEventListener('click', () => {
    historyPanel.style.display = 'flex';
    renderHistory();
  });
  
  closeHistoryBtn.addEventListener('click', () => {
    historyPanel.style.display = 'none';
  });
  
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all request history?')) {
      requestHistory = [];
      localStorage.removeItem('requestHistory');
      renderHistory();
    }
  });
  
  function renderHistory() {
    if (requestHistory.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-text">No request history</div>
          <div class="empty-state-subtext">Your API requests will appear here</div>
        </div>
      `;
      return;
    }
    
    historyList.innerHTML = '';
    
    // Show most recent first
    [...requestHistory].reverse().forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      const time = new Date(item.timestamp).toLocaleString();
      const statusClass = item.status >= 200 && item.status < 300 ? 'success' : 'error';
      
      historyItem.innerHTML = `
        <div class="history-item-header">
          <span class="method-badge method-${item.method.toLowerCase()}">${item.method}</span>
          <span class="history-item-time">${time}</span>
        </div>
        <div class="history-item-endpoint">${item.endpoint}</div>
        <span class="history-item-status ${statusClass}">Status: ${item.status}</span>
      `;
      
      historyItem.addEventListener('click', () => {
        // Replay the request
        replayRequest(item);
        historyPanel.style.display = 'none';
      });
      
      historyList.appendChild(historyItem);
    });
  }
  
  function replayRequest(item) {
    // Find the endpoint in the API spec and open request builder
    if (apiSpec) {
      apiSpec.forEach((api, apiIndex) => {
        const paths = api.paths || {};
        Object.keys(paths).forEach(path => {
          if (path === item.path || item.endpoint.includes(path.replace(/\{[^}]+\}/g, ''))) {
            const methods = Object.keys(paths[path]);
            if (methods.includes(item.method.toLowerCase())) {
              openRequestBuilder(api, path, item.method.toLowerCase(), apiIndex);
              
              // Pre-fill parameters if available
              if (item.params) {
                setTimeout(() => {
                  Object.keys(item.params).forEach(key => {
                    const input = document.querySelector(`input[name="${key}"]`);
                    if (input) input.value = item.params[key];
                  });
                }, 100);
              }
              
              // Pre-fill body if available
              if (item.body) {
                setTimeout(() => {
                  const bodyEditor = document.getElementById('request-body-editor');
                  if (bodyEditor) {
                    bodyEditor.value = JSON.stringify(item.body, null, 2);
                  }
                }, 100);
              }
            }
          }
        });
      });
    }
  }
}

// Add request to history
function addToHistory(method, endpoint, path, status, params, body) {
  const historyItem = {
    method: method,
    endpoint: endpoint,
    path: path,
    status: status,
    params: params,
    body: body,
    timestamp: new Date().toISOString()
  };
  
  requestHistory.push(historyItem);
  
  // Keep only last 50 requests
  if (requestHistory.length > 50) {
    requestHistory.shift();
  }
  
  // Save to localStorage
  localStorage.setItem('requestHistory', JSON.stringify(requestHistory));
}

// Saved Configurations Management
function initConfigs() {
  const showConfigsBtn = document.getElementById('show-configs-btn');
  const configsPanel = document.getElementById('configs-panel');
  const closeConfigsBtn = document.getElementById('close-configs');
  const saveCurrentConfigBtn = document.getElementById('save-current-config-btn');
  const configsList = document.getElementById('configs-list');
  
  // Load configs from localStorage
  const savedConfigurations = localStorage.getItem('savedConfigs');
  if (savedConfigurations) {
    savedConfigs = JSON.parse(savedConfigurations);
  }
  
  showConfigsBtn.addEventListener('click', () => {
    configsPanel.style.display = 'flex';
    renderConfigs();
  });
  
  closeConfigsBtn.addEventListener('click', () => {
    configsPanel.style.display = 'none';
  });
  
  saveCurrentConfigBtn.addEventListener('click', () => {
    if (!currentConfig) {
      alert('No active configuration to save');
      return;
    }
    
    const name = prompt('Enter a name for this configuration:');
    if (name) {
      const config = {
        name: name,
        host: currentConfig.waf_host,
        port: currentConfig.waf_port,
        protocol: currentConfig.waf_protocol,
        timestamp: new Date().toISOString()
      };
      
      savedConfigs.push(config);
      localStorage.setItem('savedConfigs', JSON.stringify(savedConfigs));
      renderConfigs();
    }
  });
  
  function renderConfigs() {
    if (savedConfigs.length === 0) {
      configsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💾</div>
          <div class="empty-state-text">No saved configurations</div>
          <div class="empty-state-subtext">Save your WAF configurations for quick access</div>
        </div>
      `;
      return;
    }
    
    configsList.innerHTML = '';
    
    savedConfigs.forEach((config, index) => {
      const configCard = document.createElement('div');
      configCard.className = 'config-item-card';
      
      configCard.innerHTML = `
        <div class="config-item-header">
          <div class="config-item-name">${config.name}</div>
          <div class="config-item-actions">
            <button class="btn-icon-small load-config" data-index="${index}" title="Load">📥</button>
            <button class="btn-icon-small delete-config" data-index="${index}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="config-item-details">
          <div><strong>Host:</strong> ${config.host}</div>
          <div><strong>Port:</strong> ${config.port}</div>
          <div><strong>Protocol:</strong> ${config.protocol}</div>
          <div><strong>Saved:</strong> ${new Date(config.timestamp).toLocaleString()}</div>
        </div>
      `;
      
      configsList.appendChild(configCard);
    });
    
    // Add event listeners
    document.querySelectorAll('.load-config').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        loadConfig(savedConfigs[index]);
      });
    });
    
    document.querySelectorAll('.delete-config').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (confirm(`Delete configuration "${savedConfigs[index].name}"?`)) {
          savedConfigs.splice(index, 1);
          localStorage.setItem('savedConfigs', JSON.stringify(savedConfigs));
          renderConfigs();
        }
      });
    });
  }
  
  function loadConfig(config) {
    // Pre-fill login form
    document.getElementById('host').value = config.host;
    document.getElementById('port').value = config.port;
    document.getElementById('protocol').value = config.protocol;
    
    // Close panel and show login section
    configsPanel.style.display = 'none';
    showLoginSection();
    
    // Focus on username field
    document.getElementById('username').focus();
  }
}

// Keyboard Shortcuts
function initKeyboardShortcuts() {
  let hintTimeout;
  
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('endpoint-search');
      if (searchInput && apiSection.style.display !== 'none') {
        searchInput.focus();
        showKeyboardHint('Search focused');
      }
    }
    
    // Ctrl/Cmd + H: Toggle history
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault();
      const historyPanel = document.getElementById('history-panel');
      if (apiSection.style.display !== 'none') {
        if (historyPanel.style.display === 'flex') {
          historyPanel.style.display = 'none';
        } else {
          historyPanel.style.display = 'flex';
          document.getElementById('history-list').innerHTML = '';
          initHistory();
        }
        showKeyboardHint('History toggled');
      }
    }
    
    // Ctrl/Cmd + S: Toggle saved configs
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const configsPanel = document.getElementById('configs-panel');
      if (apiSection.style.display !== 'none') {
        if (configsPanel.style.display === 'flex') {
          configsPanel.style.display = 'none';
        } else {
          configsPanel.style.display = 'flex';
          document.getElementById('configs-list').innerHTML = '';
          initConfigs();
        }
        showKeyboardHint('Configs toggled');
      }
    }
    
    // Ctrl/Cmd + Enter: Send request (if request builder is open)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const requestBuilder = document.getElementById('request-builder');
      if (requestBuilder && requestBuilder.style.display !== 'none') {
        e.preventDefault();
        sendApiRequest();
        showKeyboardHint('Request sent');
      }
    }
    
    // Escape: Close panels
    if (e.key === 'Escape') {
      document.getElementById('history-panel').style.display = 'none';
      document.getElementById('configs-panel').style.display = 'none';
      const requestBuilder = document.getElementById('request-builder');
      if (requestBuilder && requestBuilder.style.display !== 'none') {
        closeRequestBuilder();
      }
    }
  });
  
  function showKeyboardHint(text) {
    // Remove existing hint
    const existingHint = document.querySelector('.keyboard-hint');
    if (existingHint) {
      existingHint.remove();
    }
    
    // Create new hint
    const hint = document.createElement('div');
    hint.className = 'keyboard-hint';
    hint.textContent = text;
    document.body.appendChild(hint);
    
    // Clear previous timeout
    if (hintTimeout) {
      clearTimeout(hintTimeout);
    }
    
    // Remove after 2 seconds
    hintTimeout = setTimeout(() => {
      hint.remove();
    }, 2000);
  }
}

// Enhanced sendApiRequest with history tracking
const originalSendApiRequest = sendApiRequest;
sendApiRequest = async function() {
  const method = selectedEndpoint?.method.toUpperCase();
  const path = selectedEndpoint?.path;
  
  // Collect params for history
  const paramInputs = document.querySelectorAll('.param-input');
  const params = {};
  paramInputs.forEach(input => {
    if (input.value.trim()) {
      params[input.name] = input.value.trim();
    }
  });
  
  // Get body for history
  let body = null;
  const bodyEditor = document.getElementById('request-body-editor');
  if (bodyEditor && bodyEditor.value.trim()) {
    try {
      body = JSON.parse(bodyEditor.value);
    } catch (e) {
      // Ignore parse errors for history
    }
  }
  
  // Call original function
  await originalSendApiRequest();
  
  // Add to history after request completes
  const responseStatusCode = document.getElementById('response-status-code');
  if (responseStatusCode && method && path) {
    const status = parseInt(responseStatusCode.textContent) || 0;
    let endpoint = path;
    Object.keys(params).forEach(key => {
      endpoint = endpoint.replace(`{${key}}`, params[key]);
    });
    addToHistory(method, endpoint, path, status, params, body);
  }
};

// Initialize all enhanced features when API section is shown
const originalShowApiSection = showApiSection;
showApiSection = function() {
  originalShowApiSection();
  
  // Initialize enhanced features
  setTimeout(() => {
    initDarkMode();
    initSearch();
    initHistory();
    initConfigs();
    initKeyboardShortcuts();
  }, 100);
};

// Initialize dark mode immediately on page load
initDarkMode();

// Load and display saved configurations on login screen
function loadLoginScreenConfigs() {
  const loginConfigsSection = document.getElementById('login-saved-configs');
  const loginConfigsList = document.getElementById('login-configs-list');
  
  // Load configs from localStorage
  const savedConfigurations = localStorage.getItem('savedConfigs');
  if (savedConfigurations) {
    savedConfigs = JSON.parse(savedConfigurations);
  }
  
  // Only show if there are saved configs
  if (savedConfigs.length === 0) {
    loginConfigsSection.style.display = 'none';
    return;
  }
  
  loginConfigsSection.style.display = 'block';
  loginConfigsList.innerHTML = '';
  
  savedConfigs.forEach((config, index) => {
    const configCard = document.createElement('div');
    configCard.className = 'config-item-card';
    configCard.style.cursor = 'pointer';
    configCard.style.transition = 'all 0.3s';
    
    configCard.innerHTML = `
      <div class="config-item-header">
        <div class="config-item-name">${config.name}</div>
        <div class="config-item-actions">
          <button class="btn-icon-small delete-login-config" data-index="${index}" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="config-item-details">
        <div><strong>Host:</strong> ${config.host}</div>
        <div><strong>Port:</strong> ${config.port}</div>
        <div><strong>Protocol:</strong> ${config.protocol}</div>
      </div>
    `;
    
    // Click on card to load config (but not on delete button)
    configCard.addEventListener('click', (e) => {
      // Don't trigger if clicking delete button
      if (!e.target.classList.contains('delete-login-config')) {
        loadConfigAndPromptLogin(config);
      }
    });
    
    // Hover effect
    configCard.addEventListener('mouseenter', () => {
      configCard.style.borderColor = '#667eea';
      configCard.style.transform = 'translateX(5px)';
    });
    
    configCard.addEventListener('mouseleave', () => {
      configCard.style.borderColor = '';
      configCard.style.transform = '';
    });
    
    loginConfigsList.appendChild(configCard);
  });
  
  // Add delete button handlers
  document.querySelectorAll('.delete-login-config').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click
      const index = parseInt(e.target.dataset.index);
      if (confirm(`Delete configuration "${savedConfigs[index].name}"?`)) {
        savedConfigs.splice(index, 1);
        localStorage.setItem('savedConfigs', JSON.stringify(savedConfigs));
        loadLoginScreenConfigs(); // Refresh the list
      }
    });
  });
}

// Load config and prompt for credentials
function loadConfigAndPromptLogin(config) {
  // Pre-fill the form
  document.getElementById('host').value = config.host;
  document.getElementById('port').value = config.port;
  document.getElementById('protocol').value = config.protocol;
  
  // Focus on username field
  document.getElementById('username').focus();
  
  // Show a helpful message
  showMessage(`📋 Configuration "${config.name}" loaded. Enter your credentials to connect.`, 'success');
  
  // Scroll to form
  loginForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
