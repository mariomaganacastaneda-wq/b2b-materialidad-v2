Plataforma  B2B\_Materialidad  
base de datos **Supabase & PostgreSQL:**

Como experto para hacer aplicaciones en ambiente web en fase 1 y en fase 2 hacer una app para los celulares.

la plataforma B2B\_Materialidad es multiempresa y cada empresa es independiente y un vendedor puede estar en varias empresas 

 para hacer lo siguiente  
Objetivo de la plataforma es guardar todos los documentos asociados a un CFDI o FActura, guardar una factura o CFDI con el soporte documental, fotos o videos en la nube para la materialidad de cada CFDI y que siempres identifique los docuoementos y me permita bajarlos,   
Poder bajar el CFDI con todos los documentos asociados o  
que me pregunte que documentos asociados quiero bajar con un check por documentos.

¿Un cliente puede pedir **muchas cotizaciones**? 👉 **Sí**  
¿Un vendedor puede hacer **muchas cotizaciones**? 👉 **Sí**  
¿Una cotización pertenece a **un solo cliente**? 👉 **Sí**  
¿Una cotización la gestiona **un solo vendedor**? 👉 **Sí**

Se quiere una plataforma o sistema de B2B\_materialidad, que permita guardar desde una cotización aceptada y firmada esta cotización va asociada a una empresa a un Vendedor hoy la política es que si dicha venta es menor a 250,000  sin IVA se genera contrato simple si es mayor o igual a 250,000 sin iva se debe solicitar firmar contrato con Fecha Cierta  
el sistema debe notificar al vendedor el subir a la plataforma B2B 

* la cotización  
* El vendedor debe capturar el monto total sin IVA de la Cotización, la plataforma evalúa si se requiere contrato o no.  
  El vendedor debe poder decir a la plataforma que la venta el cliente le exigio contrato.   
* El vendedor en caso de que el cliente le exige y paga pone fecha cierta basado en la NOM151 por debajo de la política de la empresa.  
* El vendedor debe subir la proforma o configura en la plataforma,  qie es la  solicitud es Servicio o Producto.  
* El vendedor debe configurar si es licitación o no; de default no es licitación.  
* El vendedor sube la proforma en Excel a la plataforma.  
  Damos mínimos del  clientes los datos necesarios para hacer el CFDI	  
* RFC  
* Nombre o razón social (tal como esté en el SAT)  
* Código Postal del domicilio fiscal  
* Régimen fiscal  
* Uso del CFDI  
* uno a varios Correo electrónico (opcional, para envío)  
  Sube  a la plataforma B2B\_materialidad una PROFORMA, con toda la información para hacer un CFDI. 

* La plataforma B2B\_materialidad genera un número interno para ligar todos los documentos.  
* El vendedor indica si se hace prefactura o Factura o lo indica en la PROFORMA  
* La plataforma pone en lista de documento Factura o prefactura a realizar  
* la plataforma  si se requiere contrato avisa al Vendedor.  
* la proforma para que le indique al área de Facturas o Rol Facturas que realice la prefactura o Factura   
* en caso de prefactura la realiza en el sistema externo la sube a la plataforma y le manda un mail o mensaje al vendedor para que valide la prefactura  
* Si rol Venta  valida la prefactura el sistema le avisa y lo pone en la lista de prefacturas a Timbrar.   
* Si es factura Directa la realiza el área o rol de facturación y la sube a la plataforma.  
* la plataforma le manda mail o Wathapp al vendedor  
* el vendedor debe tener la opción para mandar el mail de la empresa al cliente la factura y los soporte de la misma en forma conjunta o separados.  
* la plataforma tiene todos los documentos o archivos ligados a la solicitud porque si se requiere se puedan bajar todo los documento ligados a una factura para tener la materialidad que es el objetivo de la plataforma.  
* dentro de los documento la plataforma debe perimitir subir bitácoras y/o órdenes de compra y/o Contratos y/o Avance de obra y/o 

El vendedor debe elaborar el contrato y acordarlo con el represente ligar para su firma y de requerir fecha cierta 

* El vendedor y/o CxC da seguimiento a la ficha de pago  
* la ficha de Pago se sube a la plataforma   
* debe quedar ligado desde la cotización, contrato, ordenes de compra mail documento de materialización para su consulta e bajarlos para su revisión y/o auditoria del año presente y 5 años que solicita la autoridad.

Un sistema para rentarse a diferente empresas  
Un Super usuario para dar de alta a administrador de cada empresa.  
El administrador de la Empresa configura los datos maestros de su empresa

* Id de la empresa  
* Nombre de la empresa   
* RFC  
* CP de la empresa  
* Documento para una licitación

Datos Cliente

* Razón Social  
* RFC cliente  
* CP del Cliente  
* Dirección del Cliente  
* ID Regime Fiscal del cliente  
* ID del uso del CFDI  
* ID de Forma de Pago  
* ID de Método de Pago  
* Tipo de de Comprobante (Ingreso, Egreso)  
* Subtotal de la Factura  
* IVA de la Factura  
* Total de la Factura  
* Descuento de la Factura   
* uno o varios mail para enviar el CFDI

	Este cliente pude tener vender 1 o varios Productos  
	este detalle de productos tiene

* Clave de producto (segun catálogo de Hacienda y Actividades Economicas)  
* Cantidad  
* ID Unidad  
* Descripción  
* Precio Unitario  
* Total del Producto  
*  Descuento del Producto

el usuaria administrador de la empresa accesa atraves de un correo externo y el sistema le solicita una contraseña.  
el sistema genera una clave de 6 digitos para la primera ocasión o si se le olvida la contraseña  
el sistema guarda de cada usuario Mail como acceso y opcional su whatsapp para avisarle al área de facturación o area de ventas que ya avanzo su solicitud de factura  
el administrador crea los roles

* Cliente   
* Vendedor  
* Representantes Legales (para firma de Contratos)  
* Gestor de Fecha Cierta  
* Facturación  
* CxC  
* Contable

Un Vendedor le manda una o varias cotizaciones al cliente o el cliente le solicita una o varias Cotización al Vendedor.

