"""
WAF API Handler - Proxy requests to Barracuda WAF appliance
"""
import requests
import json
from typing import Dict, Any, Optional, Tuple
from config import config
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WAFAPIHandler:
    """Handler for proxying requests to Barracuda WAF API"""
    
    def __init__(self):
        self.config = config
    
    def make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Tuple[Dict[str, Any], int]:
        """
        Make a request to the WAF API
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
            endpoint: API endpoint path (e.g., '/services')
            params: Query parameters
            data: Request body data
            headers: Additional headers
            
        Returns:
            Tuple of (response_data, status_code)
        """
        # Check if WAF is configured
        if not self.config.is_configured():
            return {
                'error': 'WAF not configured',
                'message': 'Please configure WAF host and API token'
            }, 400
        
        # Construct full URL
        # Remove leading slash from endpoint if present to avoid double slashes
        endpoint = endpoint.lstrip('/')
        url = f"{self.config.base_url}/{endpoint}"
        
        # Prepare headers
        request_headers = self.config.get_headers()
        if headers:
            request_headers.update(headers)
        
        # Log request details (without sensitive data)
        logger.info(f"Making {method} request to: {url}")
        if params:
            logger.info(f"Query params: {params}")
        
        try:
            # Make the request with Basic Auth (token as username, empty password)
            response = requests.request(
                method=method.upper(),
                url=url,
                params=params,
                json=data,
                headers=request_headers,
                auth=self.config.get_auth(),
                verify=self.config.verify_ssl,
                timeout=self.config.request_timeout
            )
            
            # Log response status
            logger.info(f"Response status: {response.status_code}")
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                # If response is not JSON, return text
                response_data = {
                    'data': response.text,
                    'content_type': response.headers.get('Content-Type', 'text/plain')
                }
            
            return response_data, response.status_code
            
        except requests.exceptions.Timeout:
            logger.error(f"Request timeout after {self.config.request_timeout} seconds")
            return {
                'error': 'Request timeout',
                'message': f'Request to WAF timed out after {self.config.request_timeout} seconds'
            }, 504
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {str(e)}")
            return {
                'error': 'Connection error',
                'message': f'Could not connect to WAF at {self.config.waf_host}',
                'details': str(e)
            }, 503
            
        except requests.exceptions.SSLError as e:
            logger.error(f"SSL error: {str(e)}")
            return {
                'error': 'SSL error',
                'message': 'SSL certificate verification failed',
                'details': str(e),
                'hint': 'Set WAF_VERIFY_SSL=false to disable SSL verification (not recommended for production)'
            }, 495
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {str(e)}")
            return {
                'error': 'Request error',
                'message': 'An error occurred while making the request',
                'details': str(e)
            }, 500
    
    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """Make a GET request"""
        return self.make_request('GET', endpoint, params=params)
    
    def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """Make a POST request"""
        return self.make_request('POST', endpoint, params=params, data=data)
    
    def put(self, endpoint: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """Make a PUT request"""
        return self.make_request('PUT', endpoint, params=params, data=data)
    
    def patch(self, endpoint: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """Make a PATCH request"""
        return self.make_request('PATCH', endpoint, params=params, data=data)
    
    def delete(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
        """Make a DELETE request"""
        return self.make_request('DELETE', endpoint, params=params)
    
    def login(self, host: str, port: int, protocol: str, username: str, password: str, api_version: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
        """
        Login to WAF and retrieve authentication token
        
        Args:
            host: WAF hostname or IP
            port: WAF port
            protocol: http or https
            username: WAF username
            password: WAF password
            api_version: API version (default: uses configured version or v3.2 for login)
            
        Returns:
            Tuple of (response_data, status_code)
        """
        # Use provided api_version, or fall back to v3.2 for login
        if api_version is None:
            api_version = 'v3.2'
        
        # Construct login URL
        login_url = f"{protocol}://{host}:{port}/restapi/{api_version}/login"
        
        # Prepare login payload
        payload = {
            'username': username,
            'password': password
        }
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        logger.info(f"Attempting login to: {login_url}")
        
        try:
            # Make login request
            response = requests.post(
                url=login_url,
                json=payload,
                headers=headers,
                verify=self.config.verify_ssl,
                timeout=self.config.request_timeout
            )
            
            logger.info(f"Login response status: {response.status_code}")
            
            # Parse response
            try:
                response_data = response.json()
            except json.JSONDecodeError:
                response_data = {'data': response.text}
            
            if response.status_code == 200 and 'token' in response_data:
                # Extract and clean the token - remove ALL whitespace including newlines
                token = response_data['token'].strip().replace('\n', '').replace('\r', '').replace(' ', '')
                
                # Update configuration with new settings
                self.config.waf_host = host
                self.config.waf_port = port
                self.config.waf_protocol = protocol
                self.config.waf_api_token = token
                # Keep the configured API version (don't override it)
                # Note: api_version is only updated if not already set in config
                if not self.config.api_version:
                    self.config.api_version = 'v3.2'
                
                return {
                    'success': True,
                    'message': 'Login successful',
                    'token': token,
                    'config': self.config.to_dict(include_token=False)
                }, 200
            else:
                return {
                    'success': False,
                    'message': 'Login failed',
                    'details': response_data
                }, response.status_code
                
        except requests.exceptions.Timeout:
            logger.error(f"Login request timeout after {self.config.request_timeout} seconds")
            return {
                'success': False,
                'error': 'Request timeout',
                'message': f'Login request timed out after {self.config.request_timeout} seconds'
            }, 504
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error during login: {str(e)}")
            return {
                'success': False,
                'error': 'Connection error',
                'message': f'Could not connect to WAF at {host}:{port}',
                'details': str(e)
            }, 503
            
        except requests.exceptions.SSLError as e:
            logger.error(f"SSL error during login: {str(e)}")
            return {
                'success': False,
                'error': 'SSL error',
                'message': 'SSL certificate verification failed',
                'details': str(e),
                'hint': 'Set WAF_VERIFY_SSL=false to disable SSL verification (not recommended for production)'
            }, 495
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error during login: {str(e)}")
            return {
                'success': False,
                'error': 'Request error',
                'message': 'An error occurred during login',
                'details': str(e)
            }, 500
    
    def test_connection(self) -> Tuple[Dict[str, Any], int]:
        """
        Test the connection to the WAF API
        
        Returns:
            Tuple of (response_data, status_code)
        """
        if not self.config.is_configured():
            return {
                'success': False,
                'error': 'WAF not configured',
                'message': 'Please configure WAF host and API token'
            }, 400
        
        # Try to get a simple endpoint to test connectivity
        # Most WAF APIs have a services or system endpoint
        response_data, status_code = self.get('services')
        
        if status_code == 200:
            return {
                'success': True,
                'message': 'Successfully connected to WAF API',
                'waf_host': self.config.waf_host
            }, 200
        else:
            return {
                'success': False,
                'message': 'Failed to connect to WAF API',
                'details': response_data
            }, status_code


# Global handler instance
waf_handler = WAFAPIHandler()
