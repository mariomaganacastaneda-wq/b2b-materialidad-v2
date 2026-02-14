INSERT INTO public.cat_cfdi_unidades (code, name, description, symbol)
VALUES ('XZT', 'Contenedor intermedio para gráneles con tablero de fibras', NULL, NULL),
('XZU', 'Contenedor intermedio para gráneles flexible', NULL, NULL),
('XZV', 'Contenedor intermedio para gráneles de metal, distinto del acero', NULL, NULL),
('XZW', 'Contenedor intermedio para gráneles, de madera natural', NULL, NULL),
('XZX', 'Contenedor intermedio para gráneles, de contrachapado', NULL, NULL),
('XZY', 'Contenedor intermedio para gráneles, de madera reconstituida', NULL, NULL),
('YDK', 'Yarda cuadrada', 'Es una unidad anglosajona de superficie de una yarda de lado.', 'yd²'),
('YDQ', 'Yarda cúbica', NULL, 'yd³'),
('YL', 'Cien yardas lineales', NULL, NULL),
('YRD', 'Yarda', 'Es la unidad de longitud básica en los sistemas de medida utilizados en Estados Unidos, Panamá y Reino Unido. Equivale a 91.4 centímetros.', 'yd'),
('YT', 'Diez yardas', NULL, NULL),
('Z1', 'Furgoneta', NULL, NULL),
('Z11', 'Contenedor colgante', 'Unidad de conteo que define el número de contenedores colgantes.', NULL),
('Z5', 'Arrastre', NULL, NULL),
('Z6', 'Punto de conferencia', NULL, NULL),
('Z8', 'Página de noticias', NULL, NULL),
('ZP', 'Páginas', 'Unidad de conteo que define el número de páginas', NULL),
('ZZ', 'Mutuamente definido', 'Unidad de medida acordada en común entre dos o más partes', NULL)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    symbol = EXCLUDED.symbol,
    updated_at = NOW();