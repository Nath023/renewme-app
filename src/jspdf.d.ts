// src/jspdf.d.ts
import 'jspdf';
// import { UserOptions } from 'jspdf-autotable'; // Try importing this

declare module 'jspdf' {
  interface jsPDF {
    // Same as above
    autoTable: (options: { /* ... define more specific options ... */ [key: string]: any; }) => jsPDF;
  }
}