/**
 * Email.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */
var async = require('async');

module.exports = {

	attributes: {
		extracted_data: {
			type: 'json',
			required: true,
		},
		email:{
			type:'text',
		},
		user: {
			model: 'user',
			required: true
		},
		type: {
			type: 'text',
			required: true,
			// enum:[
			// 	'credit_card_alert','credit_card_statement','bank_transaction_alert','bank_statement'
			// ]
		},
		body_parser_used:{
			type:'text',

		},
		message_id:{
			type:'text',
			required:true,
			unique:true,
		},
		transaction:{ // the accociated transaction
			model:'transaction',
			// required is true, but when initially created, it is created without a ref to transaction.
		}
	},
	afterCreate: function(pe, cb) {
		// console.log('after create of parsed_email');
		// find or create transaction
		// update accociated transaction on this this table
		// console.log('parsed_email after create #1');
		async.auto({
			getAccount:function(callback){
				// console.log('parsed_email after create #2');
				
				var acc_number;
				if(pe.extracted_data.credit_card_last_4_digits)
					acc_number=pe.extracted_data.credit_card_last_4_digits;
				else if(pe.extracted_data.account_last_4_digits)
					acc_number=pe.extracted_data.account_last_4_digits;
				else{
					switch(pe.type){
						case 'AmazonPayTransactionFilter':
					}
					if(pe.type=='AmazonPayTransactionFilter' || pe.type=='AmazonPayCashbackFilter' || pe.type=='AmazonPayExternalFilter')
						acc_number=pe.email+'-amazon_pay';
					else if(pe.type=='PaytmFilter'){
						if(pe.body_parser_used=='received_money_v1')
							acc_number=pe.extracted_data.to;
						else
							acc_number=pe.extracted_data.from_phone;
					}
				}
				var filter = {
					like:{
						acc_number:'%'+acc_number, // ends with the following number
					},
					user:pe.user
				}

				var account={ // incase the account does not exist, create account.
					acc_number:''+acc_number,
					user:pe.user,
					type:'bank', // user might need to change this
					name:'Auto generated account'+acc_number,
				} 
				// console.log(filter);
				// console.log(account);
				Account.findOne(filter).exec(function(err,result){
					if(result)
						callback(err,result);
					else{
						Account.create(account).exec(function(err,result){
							callback(err,result);
						});
					}
				});
			},
			getToAccount:function(callback){
				// console.log('getToAccount');
				if(pe.type=='ZerodhaTransferFilter'){
					var acc_number=pe.email+'-zerodha';
					var filter = {
						like:{
							acc_number:'%'+acc_number, // ends with the following number
						},
						user:pe.user
					}

					var account={ // incase the account does not exist, create account.
						acc_number:''+acc_number,
						user:pe.user,
						type:'investment', // user might need to change this
						name:'Zerodha - Auto generated account',
					} 
					Account.findOne(filter).exec(function(err,result){
						if(result)
							callback(err,result);
						else{
							Account.create(account).exec(function(err,result){
								callback(err,result);
							});
						}
					});
				}else{
					callback(null);
				}
			},
			findOrCreateTransaction:['getAccount','getToAccount',function(results,callback){
				//skip if it only contains information about account balance.
				if(!pe.extracted_data.currency)
					pe.extracted_data.currency='INR';
				if(pe.type=='HdfcBankBalanceFilter')
					return callback(null);
				console.log('parsed_email after create #3');
				const fx = require('money');
				fx.base='INR';
				fx.rates=sails.config.fx_rates;
				var findFilter={
					createdBy:'user',
					original_currency:pe.extracted_data.currency,
					original_amount:pe.extracted_data.amount,
					// needs a bit more filtering
				};
				
				var t={
					original_currency:pe.extracted_data.currency,
					createdBy:'parsed_email',
					type:'income_expense',
					account:results.getAccount.id,
					third_party:pe.extracted_data.whom_you_paid?pe.extracted_data.whom_you_paid:pe.extracted_data.third_party,
				}
				if(pe.type=='ZerodhaTransferFilter'){
					t.type='transfer';
					t.third_party=null;
					t.to_account=results.getToAccount.id;
				}

				
				if(pe.type=='IciciCreditCardRefundFilter' || pe.type=='AmazonPayCashbackFilter' || pe.type=='HdfcBankAccountCreditFilter')
					t.original_amount=pe.extracted_data.amount; // this is an income, so positive
				else 
					t.original_amount=-(pe.extracted_data.amount); // this in an expense, so negative

				if(pe.type=='PaytmFilter'){
					if(pe.body_parser_used=='received_money_v1'){
						t.original_amount=pe.extracted_data.amount;	 // income					
						t.third_party=pe.extracted_data.from_phone+'('+pe.extracted_data.from_name+')';
					}else{
						if(pe.extracted_data.to_phone)
							t.third_party=pe.extracted_data.to_phone+'('+pe.extracted_data.to_name+')';
						else 
							t.third_party=pe.extracted_data.to_name;
					}
				}
				t.amount_inr=fx.convert(t.original_amount, {from: pe.extracted_data.currency, to: "INR"});
				
				if(pe.extracted_data.date && pe.extracted_data.time){
					t.occuredAt= new Date(pe.extracted_data.date+' '+pe.extracted_data.time+'+5:30');
					if(t.occuredAt=='Invalid Date')
						t.occuredAt=pe.extracted_data.email_received_time;
				}
				else
					t.occuredAt=pe.extracted_data.email_received_time;

				// console.log('\n\n\nbefore transaction find or create');

				Transaction.create(t).exec(function(err,result){
					if(err){
						console.log('Attempt to create a transaction failed');
						console.log('transaction:')
						console.log(t);
						console.log('extracted_data');
						console.log(pe.extracted_data);
					}
					callback(err,result);

				});
				
			}],
			updateParsedEmail:['findOrCreateTransaction',function(results,callback){
				//skip if it only contains information about account balance.
				if(pe.type=='HdfcBankBalanceFilter')
					return callback(null);
				// console.log('update parsed email');
				Parsed_email.update({id:pe.id},{transaction:results.findOrCreateTransaction.id}).exec(callback);
			}],
			createSnapshotIfPossible:['getAccount',function(results,callback){
				// console.log('create snapshot');
				if(pe.extracted_data.balance_currency && pe.extracted_data.balance_amount){
					var ss={
						account:results.getAccount.id,
						createdBy:'parsed_email',
						// takenAt: new Date(pe.extracted_data.date+' '+pe.extracted_data.time+'+5:30'),
						balance_currency:pe.extracted_data.balance_currency,
						balance:pe.extracted_data.balance_amount,
					}
					if(pe.extracted_data.date && pe.extracted_data.time){
						ss.takenAt= new Date(pe.extracted_data.date+' '+pe.extracted_data.time+'+5:30');
						if(ss.takenAt=='Invalid Date')
							ss.takenAt=pe.extracted_data.email_received_time;
					}
					else
						ss.takenAt=pe.extracted_data.email_received_time;
					Snapshot.create(ss).exec(callback);
				}else if(pe.extracted_data.credit_limit_currency && pe.extracted_data.credit_limit_amount && pe.extracted_data.available_credit_balance){
					var ss={
						account:results.getAccount.id,
						createdBy:'parsed_email',
						// takenAt: new Date(pe.extracted_data.date+' '+pe.extracted_data.time+'+5:30'),
						balance_currency:pe.extracted_data.credit_limit_currency,
						balance:pe.extracted_data.available_credit_balance-pe.extracted_data.credit_limit_amount,
					}
					if(pe.extracted_data.date && pe.extracted_data.time){
						ss.takenAt= new Date(pe.extracted_data.date+' '+pe.extracted_data.time+'+5:30');
						if(ss.takenAt=='Invalid Date')
							ss.takenAt=pe.extracted_data.email_received_time;
					}
					else
						ss.takenAt=pe.extracted_data.email_received_time;
					Snapshot.create(ss).exec(callback);
				}else{
					callback(null);
				}
			}]
		},cb)

		// Transaction.findOrCreate({},)
	}
};

