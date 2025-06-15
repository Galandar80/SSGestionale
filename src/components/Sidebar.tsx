
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Users, 
  FileText, 
  TrendingUp, 
  PieChart, 
  Mail,
  Menu,
  X
} from "lucide-react";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar = ({ activeSection, setActiveSection, isOpen, setIsOpen }: SidebarProps) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "members", label: "Libro Soci", icon: Users },
    { id: "minutes", label: "Libro Verbali", icon: FileText },
    { id: "budget", label: "Bilancio", icon: TrendingUp },
    { id: "planning", label: "Bilancio Preventivo", icon: PieChart },
    { id: "mailing", label: "Mailing List", icon: Mail },
  ];

  return (
    <div className={`fixed left-0 top-0 h-full bg-white shadow-lg transition-all duration-300 z-50 ${isOpen ? 'w-64' : 'w-16'}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          {isOpen && (
            <h2 className="text-xl font-bold text-gray-800">Gestionale</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="p-2"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                activeSection === item.id ? 'bg-blue-100 border-r-2 border-blue-500' : ''
              }`}
            >
              <Icon size={20} className={`${activeSection === item.id ? 'text-blue-600' : 'text-gray-600'}`} />
              {isOpen && (
                <span className={`ml-3 ${activeSection === item.id ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
