import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "w-16 h-16", showText = false }: LogoProps) {
  return (
    <div className="flex flex-col items-center">
      <div className={className}>
        <svg 
          viewBox="0 0 400 400" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-2xl"
        >
          <defs>
            {/* Ouro Metálico Vibrante */}
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8A6E2F" />
              <stop offset="20%" stopColor="#F9E4B7" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="80%" stopColor="#F9E4B7" />
              <stop offset="100%" stopColor="#8A6E2F" />
            </linearGradient>
            
            {/* Azul Profundo com Profundidade */}
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* Sombra para dar volume */}
            <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
              <feOffset dx="1" dy="1" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Caminho para o texto curvado superior */}
            <path id="topTextPath" d="M30 165 C30 165 200 35 370 165" />
            
            {/* Caminho para o texto curvado inferior */}
            <path id="bottomTextPath" d="M80 315 Q200 340 320 315" />
          </defs>

          {/* Escudo Principal */}
          <path 
            d="M200 20 L285 5 L370 20 L390 110 C390 250 200 380 200 380 C200 380 10 250 10 110 L30 20 L115 5 Z" 
            fill="url(#shieldGrad)" 
            stroke="url(#goldGrad)" 
            strokeWidth="10"
          />

          {/* Silhueta Detalhada da Universidade de Coimbra (Subida e mais realista) */}
          <g opacity="0.2" fill="url(#goldGrad)" stroke="#F9E4B7" strokeWidth="0.5">
            {/* A Torre (A Cabra) - Mais detalhada e alta */}
            <path d="M192 80 H208 V140 H192 Z" /> {/* Corpo da torre */}
            <path d="M188 80 L200 60 L212 80 Z" /> {/* Topo piramidal */}
            <circle cx="200" cy="95" r="4" fill="#0f172a" stroke="none" /> {/* O Relógio */}
            <rect x="194" y="105" width="12" height="4" rx="1" fill="#0f172a" opacity="0.5" stroke="none" /> {/* Janela superior */}
            <rect x="194" y="115" width="12" height="4" rx="1" fill="#0f172a" opacity="0.5" stroke="none" /> {/* Janela inferior */}

            {/* Paço das Escolas (Prédios em U) */}
            <path d="M100 130 H140 V170 H100 Z" /> {/* Ala Esquerda */}
            <path d="M260 130 H300 V170 H260 Z" /> {/* Ala Direita */}
            <path d="M140 140 H260 V170 H140 Z" /> {/* Ala Central */}
            
            {/* Arcos e Colunas (Detalhes para realismo) */}
            <g fill="#0f172a" opacity="0.3" stroke="none">
              <rect x="145" y="150" width="6" height="12" rx="2" />
              <rect x="155" y="150" width="6" height="12" rx="2" />
              <rect x="165" y="150" width="6" height="12" rx="2" />
              <rect x="225" y="150" width="6" height="12" rx="2" />
              <rect x="235" y="150" width="6" height="12" rx="2" />
              <rect x="245" y="150" width="6" height="12" rx="2" />
            </g>
          </g>
          
          {/* Faixa Superior Curvada (Estilo Fita) */}
          <path 
            d="M5 150 C5 150 200 0 395 150 L380 190 C380 190 200 40 20 190 Z" 
            fill="url(#goldGrad)" 
            stroke="#5D4A1F" 
            strokeWidth="1"
          />
          
          {/* Texto Superior Curvado */}
          <text 
            fontFamily="serif" 
            fontWeight="900" 
            fontSize="28" 
            fill="#0f172a"
            className="uppercase"
          >
            <textPath href="#topTextPath" startOffset="50%" textAnchor="middle">
              Amigos Coimbra
            </textPath>
          </text>

          {/* Monograma Central "AC" */}
          <g filter="url(#textShadow)">
            <text 
              x="200" 
              y="270" 
              textAnchor="middle" 
              fontFamily="serif" 
              fontWeight="bold" 
              fontSize="160" 
              fill="url(#goldGrad)"
              style={{ letterSpacing: '-12px' }}
            >
              AC
            </text>
            <text 
              x="200" 
              y="270" 
              textAnchor="middle" 
              fontFamily="serif" 
              fontWeight="bold" 
              fontSize="160" 
              fill="none"
              stroke="#F9E4B7"
              strokeWidth="0.5"
              opacity="0.5"
              style={{ letterSpacing: '-12px' }}
            >
              AC
            </text>
          </g>

          {/* Placa Inferior Curvada */}
          <path 
            d="M70 285 Q200 315 330 285 L340 335 Q200 365 60 335 Z" 
            fill="url(#goldGrad)" 
            stroke="#5D4A1F" 
            strokeWidth="1"
          />
          
          {/* Texto Inferior Curvado */}
          <text 
            fontFamily="serif" 
            fontWeight="900" 
            fontSize="22" 
            fill="#0f172a"
            className="uppercase"
          >
            <textPath href="#bottomTextPath" startOffset="50%" textAnchor="middle">
              Amigos Coimbra
            </textPath>
          </text>

          {/* Slogan na base do escudo */}
          <text 
            x="200" 
            y="365" 
            textAnchor="middle" 
            fontFamily="serif" 
            fontStyle="italic" 
            fontSize="16" 
            fill="url(#goldGrad)"
            className="uppercase"
            style={{ letterSpacing: '3px' }}
          >
            União & Cultura
          </text>

          {/* Ramos de Louro */}
          <path 
            d="M50 330 Q20 370 120 395" 
            stroke="url(#goldGrad)" 
            strokeWidth="5" 
            fill="none" 
            strokeLinecap="round"
          />
          <path 
            d="M350 330 Q380 370 280 395" 
            stroke="url(#goldGrad)" 
            strokeWidth="5" 
            fill="none" 
            strokeLinecap="round"
          />
        </svg>
      </div>
      
      {showText && (
        <div className="mt-4 text-center">
          <h1 className="text-nexus-blue text-3xl font-serif font-bold tracking-tight uppercase">
            Amigos Coimbra
          </h1>
          <div className="h-0.5 w-16 bg-nexus-gold mx-auto my-2"></div>
          <p className="text-nexus-blue/60 text-xs font-serif italic tracking-[0.4em] uppercase">
            União & Cultura
          </p>
        </div>
      )}
    </div>
  );
}
