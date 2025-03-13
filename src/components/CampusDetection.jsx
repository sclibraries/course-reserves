import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useCustomizationStore from '../store/customizationStore';
import  useSearchStore  from '../store/searchStore'

/**
 * Utility to convert an IPv4 address to a numeric value.
 * @param {string} ip - The IPv4 address.
 * @returns {number} The numeric representation.
 */
const ipToInt = (ip) => {
    return ip.split('.')
      .reduce((acc, octet, index) => {
        return acc + (parseInt(octet, 10) * Math.pow(256, 3 - index));
      }, 0);
  };

/**
 * Compute numeric start and end for a given CIDR range.
 * @param {string} cidr - The CIDR notation (e.g., "148.85.0.0/16").
 * @returns {Object} The start and end numeric values.
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

// Define your campus IP mappings with their corresponding college codes.
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

// Precompute numeric ranges for each mapping.
const computedIPRanges = ipCampusMappings.map(mapping => {
  const { start, end } = getIPRange(mapping.cidr);
  return { ...mapping, start, end };
});

console.log('Computed IP ranges:', computedIPRanges);

/**
 * Determines the college code based on a provided IP address.
 * @param {string} ip - The client IP.
 * @returns {string} The detected college code, or 'default' if no match is found.
 */
const getCollegeFromIP = (ip) => {
  const ipInt = ipToInt(ip);
  console.log("college ip", ipInt)

  for (const mapping of computedIPRanges) {
    if (ipInt >= mapping.start && ipInt <= mapping.end) {
      return mapping.college;
    }
  }
  console.log("ip", ip)
  return 'default';
};

/**
 * CampusDetection Component:
 * - Checks for a URL query param 'college'.
 * - If absent, fetches the client's IP and determines the campus.
 * - Updates the customization store with the detected college.
 */
const CampusDetection = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlCollege = queryParams.get('college');
  const setCurrentCollege = useCustomizationStore(state => state.setCurrentCollege);

  useEffect(() => {
    // If a college is specified in the URL, that overrides IP-based detection.
    if (urlCollege) {
      setCurrentCollege(urlCollege);
    } else {
      const fetchIP = async () => {
        try {
          const response = await fetch('https://api.ipify.org?format=json');
          const data = await response.json();
          const determinedCollege = getCollegeFromIP(data.ip);
          console.log('Detected college:', determinedCollege);
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
