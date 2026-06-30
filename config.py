"""
Configuration management for WAF API Handler
"""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration class for WAF API connection settings"""
    
    def __init__(self):
        # WAF Appliance connection settings
        self.waf_host: str = os.getenv('WAF_HOST', '')
        self.waf_port: int = int(os.getenv('WAF_PORT', '8443'))
        self.waf_protocol: str = os.getenv('WAF_PROTOCOL', 'https')
        
        # Authentication
        self.waf_api_token: str = os.getenv('WAF_API_TOKEN', '')
        
        # Request settings
        self.verify_ssl: bool = os.getenv('WAF_VERIFY_SSL', 'false').lower() == 'true'
        self.request_timeout: int = int(os.getenv('WAF_REQUEST_TIMEOUT', '30'))
        
        # API version
        self.api_version: str = os.getenv('WAF_API_VERSION', 'v3.2')
    
    @property
    def base_url(self) -> str:
        """Construct the base URL for WAF API"""
        return f"{self.waf_protocol}://{self.waf_host}:{self.waf_port}/restapi/{self.api_version}"
    
    def is_configured(self) -> bool:
        """Check if minimum required configuration is present"""
        return bool(self.waf_host and self.waf_api_token)
    
    def get_headers(self) -> dict:
        """Get authentication headers for WAF API requests"""
        return {
            'Content-Type': 'application/json'
        }
    
    def get_auth(self) -> Optional[tuple]:
        """
        Get authentication tuple for requests
        Barracuda WAF requires Basic Auth with token as username and ':' as password
        """
        if self.waf_api_token:
            # Token as username, colon as password (per Barracuda WAF docs)
            return (self.waf_api_token, '')
        return None
    
    def update_from_dict(self, config_dict: dict) -> None:
        """Update configuration from a dictionary"""
        if 'waf_host' in config_dict:
            self.waf_host = config_dict['waf_host']
        if 'waf_port' in config_dict:
            self.waf_port = int(config_dict['waf_port'])
        if 'waf_protocol' in config_dict:
            self.waf_protocol = config_dict['waf_protocol']
        if 'waf_api_token' in config_dict:
            self.waf_api_token = config_dict['waf_api_token']
        if 'verify_ssl' in config_dict:
            self.verify_ssl = config_dict['verify_ssl']
        if 'request_timeout' in config_dict:
            self.request_timeout = int(config_dict['request_timeout'])
        if 'api_version' in config_dict:
            self.api_version = config_dict['api_version']
    
    def to_dict(self, include_token: bool = False) -> dict:
        """Convert configuration to dictionary"""
        config = {
            'waf_host': self.waf_host,
            'waf_port': self.waf_port,
            'waf_protocol': self.waf_protocol,
            'verify_ssl': self.verify_ssl,
            'request_timeout': self.request_timeout,
            'api_version': self.api_version,
            'base_url': self.base_url,
            'is_configured': self.is_configured()
        }
        
        if include_token:
            config['waf_api_token'] = self.waf_api_token
        else:
            # Mask the token for security
            config['waf_api_token'] = '***' if self.waf_api_token else ''
        
        return config


# Global configuration instance
config = Config()
