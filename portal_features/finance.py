"""Receipts and administrator-only cash reporting. Test money is never live revenue."""
import csv
import io
from datetime import date
from portal import Error,require,rows
from .payments import payment


def report(db,user,data):
    require(user,'admin')
    since=data.get('from','');until=data.get('to','')
    for value in (since,until):
        if value:
            try:date.fromisoformat(value)
            except (ValueError,TypeError):raise Error('Use YYYY-MM-DD report dates')
    if since and until and since>until:raise Error('Start date must be before end date')
    payments=rows(db,'''SELECT p.*,a.approval_status FROM payments p JOIN fighter_profiles a ON a.athlete_id=p.athlete_id
        WHERE (?='' OR date(coalesce(p.paid_at,p.created_at))>=?) AND (?='' OR date(coalesce(p.paid_at,p.created_at))<=?) ORDER BY p.id DESC''',(since,since,until,until))
    def totals(test):
        selected=[p for p in payments if p['is_test']==test and p['status']=='paid']
        gross=sum(p['amount_cents'] for p in selected);refunds=sum(p['refunded_cents'] for p in selected)
        return {'paid_count':len(selected),'gross_cents':gross,'refund_cents':refunds,'net_cents':gross-refunds}
    return {'payments':payments,'live':totals(0),'test':totals(1),'pending_count':sum(p['status']=='pending' for p in payments),'duplicate_count':sum(bool(p['duplicate_application_payment']) for p in payments),'currency':'EUR','from':since,'to':until}


def export_csv(db,user,data):
    result=report(db,user,data)
    columns=['id','receipt_number','created_at','paid_at','fighter_name','payer_name','payer_email','amount_eur','refunded_eur','currency','status','provider','is_test','duplicate_application_payment','approval_status']
    output=io.StringIO();writer=csv.writer(output);writer.writerow(columns)
    for row in result['payments']:
        item=dict(row,amount_eur=f"{row['amount_cents']/100:.2f}",refunded_eur=f"{row['refunded_cents']/100:.2f}")
        values=[]
        for column in columns:
            value=item.get(column) if item.get(column) is not None else ''
            if isinstance(value,str) and value.lstrip().startswith(('=','+','-','@')):value="'"+value
            values.append(value)
        writer.writerow(values)
    return output.getvalue().encode('utf-8-sig')


def receipt(db,user,pid):
    row=payment(db,user,pid)
    if row['status']!='paid' or not row['receipt_number']:raise Error('A receipt is available only after confirmed payment',409)
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except ImportError:raise Error('Receipt generation requires requirements.txt to be installed',503)
    buffer=io.BytesIO();pdf=canvas.Canvas(buffer,pagesize=A4);pdf.setTitle(row['receipt_number'])
    width,height=A4
    pdf.setFillColor(colors.HexColor('#171717'));pdf.rect(0,height-132,width,132,fill=1,stroke=0)
    pdf.setFillColor(colors.white);pdf.setFont('Helvetica-Bold',28);pdf.drawString(48,height-63,'W.U.C.O')
    pdf.setFont('Helvetica',12);pdf.drawString(48,height-92,'PAYMENT RECEIPT')
    y=height-180
    if row['is_test']:
        pdf.setFillColor(colors.HexColor('#ad5c11'));pdf.setFont('Helvetica-Bold',12);pdf.drawString(48,y,'TEST PAYMENT - NO MONEY WAS CHARGED');y-=32
    pdf.setFillColor(colors.HexColor('#171717'))
    lines=[('Receipt number',row['receipt_number']),('Paid at (UTC)',row['paid_at']),('Paid by',row['payer_name']),('Payer email',row['payer_email']),('Fighter',row['fighter_name']),('Purpose','Fighter application fee'),('Payment reference',row['provider_session'] or 'DEMO-'+str(row['id'])),('Amount','EUR 10.00'),('Refunded',f"EUR {row['refunded_cents']/100:.2f}"),('Provider',row['provider'].upper())]
    for label,value in lines:
        pdf.setFont('Helvetica',9);pdf.setFillColor(colors.HexColor('#777777'));pdf.drawString(48,y,label)
        pdf.setFillColor(colors.HexColor('#171717'));pdf.setFont('Helvetica',11)
        # IDs/emails are bounded by validation; wrap long values rather than clip them.
        value=str(value or '')
        chunks=[value[i:i+62] for i in range(0,len(value),62)] or ['']
        for index,chunk in enumerate(chunks):pdf.drawString(188,y-index*15,chunk)
        y-=max(34,len(chunks)*15+15)
    pdf.setFont('Helvetica',9);pdf.setFillColor(colors.HexColor('#777777'))
    pdf.drawString(48,75,'Payment acknowledgment. Not a VAT invoice.')
    pdf.drawString(48,60,'Payment does not guarantee application approval.')
    pdf.save();return buffer.getvalue(),row['receipt_number']
