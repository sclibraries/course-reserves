/**
 * @file Campus detection module
 * @module CampusDetection
 * @description Detects the user's campus based on URL parameters or IP address and sets it in the app state
 * @requires react
 * @requires react-router-dom
 * @requires ../store/customizationStore
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';

/**
 * Utility to convert an IPv4 address to a numeric value.
 * @function ipToInt
 * @param {string} ip - The IPv4 address.
 * @returns {number} The numeric representation.
 * @example
 * // returns 2130706433
 * ipToInt('127.0.0.1');
 */
const ipToInt = (ip) => {
  return ip.split('.')
    .reduce((acc, octet, index) => {
      return acc + (parseInt(octet, 10) * Math.pow(256, 3 - index));
    }, 0);
};

/**
 * Compute numeric start and end for a given CIDR range.
 * @function getIPRange
 * @param {string} cidr - The CIDR notation (e.g., "148.85.0.0/16").
 * @returns {{start: number, end: number}} The start and end numeric values.
 * @example
 * // returns { start: 2483027968, end: 2483093503 }
 * getIPRange('148.85.0.0/16');
 */
const getIPRange = (cidr) => {
  const [baseIP, prefixLengthStr] = cidr.split('/');
  const prefixLength = parseInt(prefixLengthStr, 10);
  
  // Calculate the base IP integer
  const ipInt = ipToInt(baseIP);
  
  // Calculate the number of IPs in this subnet
  const numIPs = Math.pow(2, 32 - prefixLength);
  
  // Calculate start and end of range
  const start = ipInt;
  const end = ipInt + numIPs - 1;
  
  return { start, end };
};

/**
 * IP-to-campus mapping definitions
 * @constant {Array<{cidr: string, college: string}>}
 * @default
 */
const ipCampusMappings = [
  { cidr: "148.85.0.0/16", college: "amherst" },
  { cidr: "192.101.188.0/24", college: "hampshire" },
  { cidr: "192.33.12.0/24", college: "hampshire" },
  { cidr: "64.254.160.0/20", college: "hampshire" },
  { cidr: "66.251.24.0/22", college: "hampshire" },
  { cidr: "74.88.88.0/22", college: "hampshire" },
  { cidr: "138.110.0.0/16", college: "mtholyoke" },
  { cidr: "128.119.0.0/16", college: "umass" },
  { cidr: "192.189.138.0/24", college: "umass" },
  { cidr: "192.80.66.0/24", college: "umass" },
  { cidr: "192.80.83.0/24", college: "umass" },
  { cidr: "206.172.168.0/17", college: "umass" },
  { cidr: "72.19.64.0/18", college: "umass" },
  { cidr: "10.0.0.0/11", college: "smith" },
  { cidr: "131.229.0.0/17", college: "smith" },
];

/**
 * Precomputed IP ranges with start and end values
 * @constant {Array<{cidr: string, college: string, start: number, end: number}>}
 */
const computedIPRanges = ipCampusMappings.map(mapping => {
  const { start, end } = getIPRange(mapping.cidr);
  return { ...mapping, start, end };
});

/**
 * Determines the college code based on a provided IP address.
 * @function getCollegeFromIP
 * @param {string} ip - The client IP.
 * @returns {string} The detected college code, or 'default' if no match is found.
 * @example
 * // returns 'smith' if IP is in Smith College range
 * getCollegeFromIP('131.229.10.25');
 */
const getCollegeFromIP = (ip) => {
  const ipInt = ipToInt(ip);
  
  for (const mapping of computedIPRanges) {
    if (ipInt >= mapping.start && ipInt <= mapping.end) {
      return mapping.college;
    }
  }
  return 'default';
};

/**
 * CampusDetection Component
 * 
 * A utility component that detects the user's campus/college and updates the application state.
 * The component doesn't render any UI elements but works in the background.
 * 
 * Detection priority:
 * 1. URL query parameter 'college' 
 * 2. Already stored college in Zustand store
 * 3. IP-based detection
 * 
 * @component
 * @example
 * return (
 *   <>
 *     <CampusDetection />
 *     <App />
 *   </>
 * )
 */
const CampusDetection = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlCollege = queryParams.get('college');
  const setCurrentCollege = useCustomizationStore(state => state.setCurrentCollege);

  useEffect(() => {
    if (urlCollege) {
      setCurrentCollege(urlCollege);
    } else {
      // Check if there's already a college set in Zustand store
      const currentStoredCollege = useCustomizationStore.getState().currentCollege;
  
      if (currentStoredCollege && currentStoredCollege !== 'default') {
        // Do nothing because college is already explicitly set by the user
        return;
      }
  
      // Perform IP detection if no stored college
      const fetchIP = async () => {
        try {
          const response = await fetch('https://api.ipify.org?format=json');
          const data = await response.json();
          const determinedCollege = getCollegeFromIP(data.ip);
          setCurrentCollege(determinedCollege);
        } catch (error) {
          console.error("Error fetching IP:", error);
        }
      };
      fetchIP();
    }
  }, [urlCollege, setCurrentCollege, location.search]);
  return null; // This component does not render any UI.
};

export default CampusDetection;